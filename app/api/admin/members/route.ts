import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Member } from "@/lib/models/Member";
import { toMember } from "@/lib/data";
import { requireAdmin } from "@/lib/guard";
import { badRequest, conflict, normalizeName, normalizePhone, serverError } from "@/lib/api";

/** GET /api/admin/members?search=&isActive=&page=&limit= */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") ?? "").trim();
    const isActiveParam = searchParams.get("isActive");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200));

    const filter: Record<string, unknown> = {};
    if (isActiveParam === "true") filter.isActive = true;
    else if (isActiveParam === "false") filter.isActive = false;

    if (search) {
      filter.$or = [
        { fullName: { $regex: escapeRegex(search), $options: "i" } },
        { phoneNumber: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Member.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      Member.countDocuments(filter),
    ]);

    return NextResponse.json({
      items: items.map(toMember),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("GET /api/admin/members failed:", err);
    return serverError();
  }
}

/** POST /api/admin/members  { fullName, phoneNumber? } */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  try {
    await connectDB();
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const fullName = String(body.fullName ?? "").trim();
    const phone = body.phoneNumber ? normalizePhone(String(body.phoneNumber)) : "";

    if (fullName.length < 2) return badRequest("Full name is required (min 2 characters).");

    const dupe = await Member.findOne({
      fullName: { $regex: `^${escapeRegex(normalizeName(fullName))}$`, $options: "i" },
    }).exec();
    if (dupe) return conflict("A member with this name already exists.");

    const created = await Member.create({
      fullName,
      phoneNumber: phone || undefined,
      isActive: true,
    });

    return NextResponse.json({ item: toMember(created) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/members failed:", err);
    return serverError();
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
