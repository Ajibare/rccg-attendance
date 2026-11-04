import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  buildAttendanceRows,
  ensureActiveService,
  summarize,
} from "@/lib/data";
import { serverError } from "@/lib/api";

/**
 * Public roster for the currently active service.
 * Returns member name + attendance status only (no phone numbers).
 */
export async function GET() {
  try {
    await connectDB();
    const service = await ensureActiveService();

    if (!service) {
      return NextResponse.json({
        service: null,
        rows: [],
        summary: { totalMembers: 0, present: 0, absent: 0, percentage: 0 },
      });
    }

    const rows = await buildAttendanceRows(service._id.toString());
    const publicRows = rows.map((r) => ({
      id: r.member.id,
      fullName: r.member.fullName,
      status: r.status,
      markedAt: r.markedAt,
    }));

    return NextResponse.json({
      service: {
        id: service._id.toString(),
        title: service.title,
        serviceDate: service.serviceDate.toISOString(),
      },
      rows: publicRows,
      summary: summarize(rows),
    });
  } catch (err) {
    console.error("GET /api/service/active failed:", err);
    return serverError();
  }
}
