import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Attendance } from "@/lib/models/Attendance";
import { requireAdmin } from "@/lib/guard";
import { badRequest, notFound, serverError, isValidObjectId } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/attendance/[id]  { status } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return badRequest("Invalid attendance id.");

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const status = String(body.status ?? "") as "present" | "absent";
    if (status !== "present" && status !== "absent")
      return badRequest("Status must be present or absent.");

    const record = await Attendance.findById(id).exec();
    if (!record) return notFound("Attendance record not found.");

    record.status = status;
    record.markedAt = status === "present" ? new Date() : undefined;
    await record.save();

    return NextResponse.json({
      attendanceId: record._id.toString(),
      status: record.status,
      markedAt: record.markedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("PATCH /api/admin/attendance/[id] failed:", err);
    return serverError();
  }
}

/** DELETE /api/admin/attendance/[id] — remove an incorrect record */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return badRequest("Invalid attendance id.");

    const record = await Attendance.findById(id).exec();
    if (!record) return notFound("Attendance record not found.");

    await Attendance.deleteOne({ _id: record._id }).exec();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/attendance/[id] failed:", err);
    return serverError();
  }
}
