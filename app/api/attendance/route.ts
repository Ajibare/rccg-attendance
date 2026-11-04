import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Member } from "@/lib/models/Member";
import { Attendance } from "@/lib/models/Attendance";
import { ensureActiveService } from "@/lib/data";
import {
  badRequest,
  serverError,
  notFound,
  isValidObjectId,
} from "@/lib/api";

/**
 * Public: mark a member present for the currently active service.
 * Idempotent — marking twice just returns the existing "present" record.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const memberId = String(body.memberId ?? "");

    if (!isValidObjectId(memberId)) return badRequest("Invalid member.");

    const service = await ensureActiveService();
    if (!service) {
      return NextResponse.json(
        { error: "No active service is available right now. Please try again shortly." },
        { status: 409 }
      );
    }

    const member = await Member.findOne({ _id: memberId, isActive: true }).exec();
    if (!member) return notFound("Member not found.");

    const existing = await Attendance.findOne({
      memberId,
      serviceId: service._id,
    }).exec();

    if (existing) {
      // Already marked — return the current state.
      return NextResponse.json({
        status: existing.status,
        markedAt: existing.markedAt?.toISOString() ?? null,
        alreadyMarked: existing.status === "present",
      });
    }

    try {
      const record = await Attendance.create({
        memberId,
        serviceId: service._id,
        status: "present",
        markedAt: new Date(),
      });
      return NextResponse.json(
        {
          status: record.status,
          markedAt: record.markedAt?.toISOString() ?? null,
          alreadyMarked: false,
        },
        { status: 201 }
      );
    } catch (e: unknown) {
      // Unique index race — fetch and return.
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: number }).code === 11000
      ) {
        const found = await Attendance.findOne({
          memberId,
          serviceId: service._id,
        }).exec();
        return NextResponse.json({
          status: found?.status ?? "present",
          markedAt: found?.markedAt?.toISOString() ?? null,
          alreadyMarked: true,
        });
      }
      throw e;
    }
  } catch (err) {
    console.error("POST /api/attendance failed:", err);
    return serverError();
  }
}
