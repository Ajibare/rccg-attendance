"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Search,
  Download,
  FileSpreadsheet,
  Check,
  X as XIcon,
  Trash2,
  ClipboardCheck,
} from "lucide-react";
import { apiFetch, downloadFile } from "@/lib/client";
import { useLoader } from "@/lib/useLoader";
import type {
  AttendanceRow,
  AttendanceSummary,
  ServiceDTO,
} from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Button, Spinner } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Users, UserCheck, UserX, Percent } from "lucide-react";

type AttendanceResp = {
  service: { id: string; title: string; serviceDate: string; isActive: boolean } | null;
  rows: AttendanceRow[];
  summary: AttendanceSummary;
};

export default function AttendancePage() {
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [data, setData] = useState<AttendanceResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "present" | "absent">("all");

  // Load services list once.
  useEffect(() => {
    apiFetch<{ items: ServiceDTO[] }>("/api/admin/services")
      .then((res) => {
        setServices(res.items);
        const active = res.items.find((s) => s.isActive);
        setServiceId(active?.id ?? res.items[0]?.id ?? "");
      })
      .catch((e) => toast.error(e.message || "Failed to load services."));
  }, []);

  const load = useCallback(async () => {
    const url = serviceId
      ? `/api/admin/attendance?serviceId=${serviceId}`
      : "/api/admin/attendance";
    try {
      const res = await apiFetch<AttendanceResp>(url);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load attendance.");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useLoader(load, [load]);

  async function setStatus(row: AttendanceRow, status: "present" | "absent") {
    setBusyId(row.member.id);
    try {
      if (row.attendanceId) {
        await apiFetch(`/api/admin/attendance/${row.attendanceId}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
      } else {
        await apiFetch("/api/admin/attendance", {
          method: "POST",
          body: JSON.stringify({ serviceId, memberId: row.member.id, status }),
        });
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeRecord(row: AttendanceRow) {
    if (!row.attendanceId) return;
    setBusyId(row.member.id);
    try {
      await apiFetch(`/api/admin/attendance/${row.attendanceId}`, { method: "DELETE" });
      toast.success("Attendance record removed.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove record.");
    } finally {
      setBusyId(null);
    }
  }

  async function exportData(format: "csv" | "xlsx") {
    if (!serviceId) return toast.error("Select a service first.");
    try {
      await downloadFile(`/api/admin/export?serviceId=${serviceId}&format=${format}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    }
  }

  const visibleRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.member.fullName.toLowerCase().includes(q)) return false;
      if (filter === "present") return r.status === "present";
      if (filter === "absent") return r.status !== "present";
      return true;
    });
  }, [data, search, filter]);

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Select a service to review and manage its attendance."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportData("csv")} disabled={!serviceId}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={() => exportData("xlsx")} disabled={!serviceId}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="max-w-sm"
          aria-label="Select service"
        >
          {services.length === 0 && <option value="">No services yet</option>}
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {new Date(s.serviceDate).toLocaleDateString()}
              {s.isActive ? " (active)" : ""}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !data || !data.service ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
          <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Create a service to start recording attendance.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Members" value={data.summary.totalMembers} icon={Users} />
            <StatCard label="Present" value={data.summary.present} icon={UserCheck} accent="green" />
            <StatCard label="Absent" value={data.summary.absent} icon={UserX} accent="slate" />
            <StatCard label="Attendance" value={`${data.summary.percentage}%`} icon={Percent} accent="amber" />
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="pl-9"
              />
            </div>
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
              {(["all", "present", "absent"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 capitalize ${
                    filter === f ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Marked</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => (
                  <tr key={row.member.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.member.fullName}</div>
                      {row.member.phoneNumber && (
                        <div className="text-xs text-slate-400">{row.member.phoneNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "present" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <Check className="h-3 w-3" /> Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          <XIcon className="h-3 w-3" /> Absent
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.markedAt ? new Date(row.markedAt).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status !== "present" && (
                          <Button
                            size="sm"
                            variant="success"
                            loading={busyId === row.member.id}
                            onClick={() => setStatus(row, "present")}
                          >
                            Mark Present
                          </Button>
                        )}
                        {row.status === "present" && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busyId === row.member.id}
                            onClick={() => setStatus(row, "absent")}
                          >
                            Mark Absent
                          </Button>
                        )}
                        {row.attendanceId && (
                          <button
                            title="Remove record"
                            onClick={() => removeRecord(row)}
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                      No members match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
