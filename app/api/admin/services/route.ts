import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Service } from "@/lib/models/Service";
import { toService } from "@/lib/data";
import { requireAdmin } from "@/lib/guard";
import { badRequest, serverError } from "@/lib/api";

/** GET /api/admin/services */
export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const services = await Service.find({}).sort({ serviceDate: -1 }).exec();
    return NextResponse.json({ items: services.map(toService) });
  } catch (err) {
    console.error("GET /api/admin/services failed:", err);
    return serverError();
  }
}

/** POST /api/admin/services  { title, serviceDate, activate? } */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const title = String(body.title ?? "").trim();
    const dateRaw = body.serviceDate;
    const activate = Boolean(body.activate);

    const serviceDate = dateRaw ? new Date(String(dateRaw)) : null;
    if (!title) return badRequest("Service title is required.");
    if (!serviceDate || isNaN(serviceDate.getTime()))
      return badRequest("A valid service date is required.");

    if (activate) {
      await Service.updateMany({ isActive: true }, { isActive: false }).exec();
    }

    const created = await Service.create({
      title,
      serviceDate,
      isActive: activate,
    });

    return NextResponse.json({ item: toService(created) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/services failed:", err);
    return serverError();
  }
}
