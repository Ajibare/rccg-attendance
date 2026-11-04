import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/db";
import { Service, IService } from "@/lib/models/Service";
import { buildAttendanceRows, getActiveService } from "@/lib/data";
import { requireAdmin } from "@/lib/guard";
import { notFound, serverError, isValidObjectId } from "@/lib/api";

/** GET /api/admin/export?serviceId=&format=csv|xlsx */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const sid = searchParams.get("serviceId");
    const format = (searchParams.get("format") ?? "csv").toLowerCase();

    let service: IService | null = null;
    if (sid && isValidObjectId(sid)) service = await Service.findById(sid).exec();
    else service = await getActiveService();

    if (!service) return notFound("No service found to export.");

    const rows = await buildAttendanceRows(service._id.toString());
    const serviceLabel = `${service.title} – ${service.serviceDate.toDateString()}`;
    const statusLabel = (s: string) => (s === "present" ? "Present" : "Absent");

    const data = rows.map((r) => ({
      "Member Name": r.member.fullName,
      "Phone Number": r.member.phoneNumber ?? "",
      Status: statusLabel(r.status),
      "Service / Date": serviceLabel,
    }));

    const safeName = service.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "attendance";

    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      return new NextResponse(out, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="attendance_${safeName}.xlsx"`,
        },
      });
    }

    // CSV
    const headers = ["Member Name", "Phone Number", "Status", "Service / Date"];
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...data.map((d) => Object.values(d).map(escape).join(",")),
    ];
    const csv = "\uFEFF" + lines.join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance_${safeName}.csv"`,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/export failed:", err);
    return serverError();
  }
}
