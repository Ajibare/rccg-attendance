import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Member } from "@/lib/models/Member";
import { buildAttendanceRows, summarize, getActiveService } from "@/lib/data";
import { requireAdmin } from "@/lib/guard";
import { serverError } from "@/lib/api";

/** GET /api/admin/overview — summary cards for the dashboard. */
export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const service = await getActiveService();

    const [totalMembers, newMembers, rows] = await Promise.all([
      Member.countDocuments({ isActive: true }),
      Member.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      service ? buildAttendanceRows(service._id.toString()) : Promise.resolve([]),
    ]);

    const summary = summarize(rows);

    return NextResponse.json({
      service: service
        ? {
            id: service._id.toString(),
            title: service.title,
            serviceDate: service.serviceDate.toISOString(),
          }
        : null,
      totalMembers,
      newMembers,
      present: summary.present,
      absent: summary.absent,
      percentage: summary.percentage,
    });
  } catch (err) {
    console.error("GET /api/admin/overview failed:", err);
    return serverError();
  }
}
