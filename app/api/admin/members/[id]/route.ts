import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Member } from "@/lib/models/Member";
import { Attendance } from "@/lib/models/Attendance";
import { toMember } from "@/lib/data";
import { requireAdmin } from "@/lib/guard";
import {
  badRequest,
  conflict,
  notFound,
  serverError,
  isValidObjectId,
  normalizeName,
  normalizePhone,
} from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/members/[id]  { fullName?, phoneNumber?, address?, isActive? } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  try {
    await connectDB();
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return badRequest("Invalid member id.");

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const member = await Member.findById(id).exec();
    if (!member) return notFound("Member not found.");

    if (typeof body.fullName === "string") {
      const fullName = body.fullName.trim();
      if (fullName.length < 2) return badRequest("Full name is too short.");
      const dupe = await Member.findOne({
        _id: { $ne: member._id },
        fullName: { $regex: `^${escapeRegex(normalizeName(fullName))}$`, $options: "i" },
      }).exec();
      if (dupe) return conflict("Another member with this name already exists.");
      member.fullName = fullName;
    }

    if (typeof body.phoneNumber === "string") {
      const phone = normalizePhone(body.phoneNumber);
      member.phoneNumber = phone || undefined;
    }

    if (typeof body.address === "string") {
      const address = body.address.trim();
      member.address = address || undefined;
    }

    if (typeof body.isActive === "boolean") {
      member.isActive = body.isActive;
    }

    await member.save();
    return NextResponse.json({ item: toMember(member) });
  } catch (err) {
    console.error("PATCH /api/admin/members/[id] failed:", err);
    return serverError();
  }
}

/** DELETE /api/admin/members/[id]  — hard delete + cascade attendance */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  try {
    await connectDB();
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return badRequest("Invalid member id.");

    const member = await Member.findById(id).exec();
    if (!member) return notFound("Member not found.");

    await Attendance.deleteMany({ memberId: member._id }).exec();
    await Member.deleteOne({ _id: member._id }).exec();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/members/[id] failed:", err);
    return serverError();
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
