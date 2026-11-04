import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Member } from "@/lib/models/Member";
import { normalizeName, normalizePhone, badRequest, serverError } from "@/lib/api";

/**
 * Public member self-registration.
 * Deduplicates by normalized name (and phone when provided) among active members.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const fullName = String(body.fullName ?? "").trim();
    const phoneNumberRaw = body.phoneNumber ? String(body.phoneNumber).trim() : "";

    if (fullName.length < 2) {
      return badRequest("Please enter your full name (at least 2 characters).");
    }

    const targetName = normalizeName(fullName);
    const existing = await Member.findOne({
      isActive: true,
      $or: [
        { fullName: { $regex: `^${escapeRegex(targetName)}$`, $options: "i" } },
      ],
    }).exec();

    if (existing) {
      // Idempotent: if the person registers twice they get the same record.
      return NextResponse.json({
        id: existing._id.toString(),
        fullName: existing.fullName,
        alreadyExisted: true,
      });
    }

    // Optional: block if phone already registered to an active member.
    if (phoneNumberRaw) {
      const phone = normalizePhone(phoneNumberRaw);
      if (phone) {
        const byPhone = await Member.findOne({
          isActive: true,
          phoneNumber: { $regex: `^${escapeRegex(phone)}$` },
        }).exec();
        if (byPhone) {
          return NextResponse.json(
            { error: "A member with this phone number is already registered." },
            { status: 409 }
          );
        }
      }
    }

    const created = await Member.create({
      fullName,
      phoneNumber: phoneNumberRaw ? normalizePhone(phoneNumberRaw) : undefined,
      isActive: true,
    });

    return NextResponse.json(
      { id: created._id.toString(), fullName: created.fullName, alreadyExisted: false },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/members failed:", err);
    return serverError();
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
