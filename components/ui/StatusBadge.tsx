"use client";
import { AttendanceStatus } from "@/lib/types";

const styles: Record<AttendanceStatus, string> = {
  present: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  absent: "bg-slate-100 text-slate-600 ring-slate-200",
  unmarked: "bg-amber-50 text-amber-700 ring-amber-200",
};

const labels: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  unmarked: "Not marked",
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
