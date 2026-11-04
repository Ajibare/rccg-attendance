import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Member } from "@/lib/models/Member";
import { Attendance } from "@/lib/models/Attendance";
import { requireAdmin } from "@/lib/guard";
import { badRequest, serverError, isValidObjectId } from "@/lib/api";

/** Normalizes an unknown request value into a de-duplicated list of ObjectId strings. */
function toObjectIdStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.map((v) => String(v)).filter(isValidObjectId);
  return [...new Set(ids)];
}

/**
 * PATCH /api/admin/members/bulk
 * { ids: string[], isActive: boolean } — activate/deactivate many members.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  try {
    await connectDB();
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const ids = toObjectIdStrings(body.ids);
    if (ids.length === 0) return badRequest("Select at least one member.");
    if (typeof body.isActive !== "boolean") return badRequest("isActive must be a boolean.");

    const res = await Member.updateMany(
      { _id: { $in: ids } },
      { $set: { isActive: body.isActive } }
    ).exec();

    return NextResponse.json({
      updated: res.modifiedCount || res.matchedCount || 0,
    });
  } catch (err) {
    console.error("PATCH /api/admin/members/bulk failed:", err);
    return serverError();
  }
}

/**
 * DELETE /api/admin/members/bulk
 * { ids: string[] } — permanently delete many members and their attendance records.
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  try {
    await connectDB();
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const ids = toObjectIdStrings(body.ids);
    if (ids.length === 0) return badRequest("Select at least one member.");

    const removedAttendance = await Attendance.deleteMany({
      memberId: { $in: ids },
    }).exec();
    const removedMembers = await Member.deleteMany({ _id: { $in: ids } }).exec();

    return NextResponse.json({
      deleted: removedMembers.deletedCount ?? 0,
      attendanceDeleted: removedAttendance.deletedCount ?? 0,
    });
  } catch (err) {
    console.error("DELETE /api/admin/members/bulk failed:", err);
    return serverError();
  }
}
