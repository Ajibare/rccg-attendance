import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Member } from "@/lib/models/Member";
import { Attendance } from "@/lib/models/Attendance";
import { Service } from "@/lib/models/Service";
import { requireAdmin } from "@/lib/guard";
import { badRequest, serverError, isValidObjectId } from "@/lib/api";

type BulkAction = "present" | "absent" | "clear";

/** Normalizes an unknown request value into a de-duplicated list of ObjectId strings. */
function toObjectIdStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.map((v) => String(v)).filter(isValidObjectId);
  return [...new Set(ids)];
}

/**
 * POST /api/admin/attendance/bulk
 * { serviceId, memberIds: string[], action: "present" | "absent" | "clear" }
 * Upserts attendance for many members at once, or removes their records.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  try {
    await connectDB();
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const serviceId = String(body.serviceId ?? "");
    const action = String(body.action ?? "") as BulkAction;
    const memberIds = toObjectIdStrings(body.memberIds);

    if (!isValidObjectId(serviceId)) return badRequest("Invalid service.");
    if (memberIds.length === 0) return badRequest("Select at least one member.");
    if (action !== "present" && action !== "absent" && action !== "clear")
      return badRequest("Action must be present, absent or clear.");

    const service = await Service.findById(serviceId).select("_id").lean().exec();
    if (!service) return badRequest("Service not found.");

    if (action === "clear") {
      const res = await Attendance.deleteMany({
        serviceId,
        memberId: { $in: memberIds },
      }).exec();
      return NextResponse.json({ affected: res.deletedCount ?? 0 });
    }

    const members = await Member.find({ _id: { $in: memberIds } })
      .select("_id")
      .exec();
    const ids = members.map((m) => m._id);
    if (ids.length === 0) return badRequest("None of the selected members exist.");

    const ops = ids.map((memberId) => {
      if (action === "present") {
        return {
          updateOne: {
            filter: { memberId, serviceId },
            update: { $set: { status: "present" as const, markedAt: new Date() } },
            upsert: true,
          },
        };
      }
      return {
        updateOne: {
          filter: { memberId, serviceId },
          update: { $set: { status: "absent" as const }, $unset: { markedAt: "" } },
          upsert: true,
        },
      };
    });

    const res = await Attendance.bulkWrite(ops);
    return NextResponse.json({
      affected: (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0),
      matched: res.matchedCount ?? 0,
    });
  } catch (err) {
    console.error("POST /api/admin/attendance/bulk failed:", err);
    return serverError();
  }
}
