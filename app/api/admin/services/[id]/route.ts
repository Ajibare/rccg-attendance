import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Service } from "@/lib/models/Service";
import { Attendance } from "@/lib/models/Attendance";
import { toService } from "@/lib/data";
import { requireAdmin } from "@/lib/guard";
import {
  badRequest,
  notFound,
  serverError,
  isValidObjectId,
} from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/services/[id]  { title?, serviceDate?, active? } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return badRequest("Invalid service id.");

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const service = await Service.findById(id).exec();
    if (!service) return notFound("Service not found.");

    if (typeof body.title === "string" && body.title.trim()) {
      service.title = body.title.trim();
    }
    if (typeof body.serviceDate === "string") {
      const d = new Date(body.serviceDate);
      if (isNaN(d.getTime())) return badRequest("Invalid service date.");
      service.serviceDate = d;
    }
    if (body.active === true) {
      await Service.updateMany({ isActive: true }, { isActive: false }).exec();
      service.isActive = true;
    } else if (body.active === false) {
      service.isActive = false;
    }

    await service.save();
    return NextResponse.json({ item: toService(service) });
  } catch (err) {
    console.error("PATCH /api/admin/services/[id] failed:", err);
    return serverError();
  }
}

/** DELETE /api/admin/services/[id] — removes service + its attendance rows */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    await connectDB();
    const { id } = await ctx.params;
    if (!isValidObjectId(id)) return badRequest("Invalid service id.");

    const service = await Service.findById(id).exec();
    if (!service) return notFound("Service not found.");

    await Attendance.deleteMany({ serviceId: service._id }).exec();
    await Service.deleteOne({ _id: service._id }).exec();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/services/[id] failed:", err);
    return serverError();
  }
}
