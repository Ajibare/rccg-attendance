import "server-only";
import mongoose from "mongoose";
import { connectDB } from "./db";
import { Member, IMember } from "./models/Member";
import { Service, IService } from "./models/Service";
import { Attendance, IAttendance, AttendanceStatus } from "./models/Attendance";

/* ----------------------------- DTO types ----------------------------- */

export type MemberDTO = {
  id: string;
  fullName: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: string;
};

export type ServiceDTO = {
  id: string;
  title: string;
  serviceDate: string;
  isActive: boolean;
  createdAt: string;
};

export type AttendanceRow = {
  member: MemberDTO;
  status: AttendanceStatus | "unmarked";
  attendanceId: string | null;
  markedAt: string | null;
};

const oid = (id: string) => new mongoose.Types.ObjectId(id);

/* --------------------------- serialization --------------------------- */

export function toMember(m: IMember): MemberDTO {
  return {
    id: m._id.toString(),
    fullName: m.fullName,
    phoneNumber: m.phoneNumber,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toService(s: IService): ServiceDTO {
  return {
    id: s._id.toString(),
    title: s.title,
    serviceDate: s.serviceDate.toISOString(),
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
  };
}

/* ------------------------------ services ----------------------------- */

export async function getActiveService(): Promise<IService | null> {
  await connectDB();
  return Service.findOne({ isActive: true }).sort({ serviceDate: -1 }).exec();
}

/**
 * Ensures there is exactly one active service.
 * If none exists, promotes the most recent by date (if any).
 */
export async function ensureActiveService(): Promise<IService | null> {
  await connectDB();
  const active = await Service.findOne({ isActive: true })
    .sort({ serviceDate: -1 })
    .exec();
  if (active) return active;

  const fallback = await Service.findOne().sort({ serviceDate: -1 }).exec();
  if (fallback) {
    fallback.isActive = true;
    await fallback.save();
  }
  return fallback;
}

/* ------------------------- attendance list (derived) ------------------ */

/**
 * Builds the attendance list for a service by taking all active members and
 * joining any existing attendance record. Members without a record are shown
 * as "unmarked" (treated as absent for summary counts). This means new
 * members and new services automatically show the correct roster without
 * pre-creating rows.
 */
export async function buildAttendanceRows(
  serviceId: string
): Promise<AttendanceRow[]> {
  await connectDB();

  const [members, attendance] = await Promise.all([
    Member.find({ isActive: true }).sort({ fullName: 1 }).exec(),
    Attendance.find({ serviceId: oid(serviceId) }).exec(),
  ]);

  const byMember = new Map<string, IAttendance>();
  for (const a of attendance) byMember.set(a.memberId.toString(), a);

  return members.map((m) => {
    const a = byMember.get(m._id.toString());
    return {
      member: toMember(m),
      status: a ? a.status : "unmarked",
      attendanceId: a ? a._id.toString() : null,
      markedAt: a?.markedAt ? a.markedAt.toISOString() : null,
    };
  });
}

export type AttendanceSummary = {
  totalMembers: number;
  present: number;
  absent: number;
  percentage: number;
};

export function summarize(rows: AttendanceRow[]): AttendanceSummary {
  const totalMembers = rows.length;
  const present = rows.filter((r) => r.status === "present").length;
  const absent = totalMembers - present;
  const percentage = totalMembers === 0 ? 0 : Math.round((present / totalMembers) * 100);
  return { totalMembers, present, absent, percentage };
}
