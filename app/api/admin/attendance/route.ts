import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Member } from "@/lib/models/Member";
import { Attendance } from "@/lib/models/Attendance";
import { Service, IService } from "@/lib/models/Service";
import { buildAttendanceRows, summarize, getActiveService } from "@/lib/data";
import { requireAdmin } from "@/lib/guard";
import {
  badRequest,
  serverError,
  isValidObjectId,
} from "@/lib/api";

/** GET /api/admin/attendance?serviceId=  (defaults to active service) */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const sid = searchParams.get("serviceId");

    let service: IService | null = null;
    if (sid && isValidObjectId(sid)) {
      service = await Service.findById(sid).exec();
    } else {
      service = await getActiveService();
    }

    if (!service) {
      return NextResponse.json({ service: null, rows: [], summary: summarize([]) });
    }

    const rows = await buildAttendanceRows(service._id.toString());
    return NextResponse.json({
      service: {
        id: service._id.toString(),
        title: service.title,
        serviceDate: service.serviceDate.toISOString(),
        isActive: service.isActive,
      },
      rows,
      summary: summarize(rows),
    });
  } catch (err) {
    console.error("GET /api/admin/attendance failed:", err);
    return serverError();
  }
}

/** POST /api/admin/attendance  { serviceId, memberId, status } — manual upsert */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const serviceId = String(body.serviceId ?? "");
    const memberId = String(body.memberId ?? "");
    const status = String(body.status ?? "present") as "present" | "absent";

    if (!isValidObjectId(serviceId) || !isValidObjectId(memberId))
      return badRequest("Invalid service or member.");
    if (status !== "present" && status !== "absent")
      return badRequest("Status must be present or absent.");

    const [service, member] = await Promise.all([
      Service.findById(serviceId).exec(),
      Member.findById(memberId).exec(),
    ]);
    if (!service) return badRequest("Service not found.");
    if (!member) return badRequest("Member not found.");

    const existing = await Attendance.findOne({ memberId, serviceId }).exec();
    if (existing) {
      existing.status = status;
      existing.markedAt = status === "present" ? new Date() : undefined;
      await existing.save();
      return NextResponse.json({
        attendanceId: existing._id.toString(),
        status: existing.status,
        markedAt: existing.markedAt?.toISOString() ?? null,
      });
    }

    const created = await Attendance.create({
      memberId,
      serviceId,
      status,
      markedAt: status === "present" ? new Date() : undefined,
    });
    return NextResponse.json(
      {
        attendanceId: created._id.toString(),
        status: created.status,
        markedAt: created.markedAt?.toISOString() ?? null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/admin/attendance failed:", err);
    return serverError();
  }
}
