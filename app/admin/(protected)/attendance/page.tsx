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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<null | "clear" | "deactivate">(null);

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

  function toggleSelected(memberId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  async function bulkStatus(status: "present" | "absent") {
    const memberIds = [...selected];
    if (memberIds.length === 0 || !serviceId) return;
    setBulkBusy(true);
    try {
      await apiFetch("/api/admin/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({ serviceId, memberIds, action: status }),
      });
      toast.success(`${memberIds.length} member(s) marked ${status}.`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update attendance.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkClearRecords() {
    const memberIds = [...selected];
    if (memberIds.length === 0 || !serviceId) return;
    setBulkBusy(true);
    try {
      await apiFetch("/api/admin/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({ serviceId, memberIds, action: "clear" }),
      });
      toast.success("Attendance records removed.");
      setBulkConfirm(null);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove records.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDeactivate() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await apiFetch("/api/admin/members/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids, isActive: false }),
      });
      toast.success(`${ids.length} member(s) deactivated.`);
      setBulkConfirm(null);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not deactivate members.");
    } finally {
      setBulkBusy(false);
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

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.member.id));
  const someVisibleSelected = visibleRows.some((r) => selected.has(r.member.id));

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
          onChange={(e) => {
            setServiceId(e.target.value);
            setSelected(new Set());
          }}
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

          {selected.size > 0 && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center">
              <p className="text-sm font-medium text-brand-900">
                {selected.size} selected
              </p>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Button
                  size="sm"
                  variant="success"
                  loading={bulkBusy}
                  onClick={() => bulkStatus("present")}
                >
                  <Check className="h-4 w-4" /> Mark Present
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={bulkBusy}
                  onClick={() => bulkStatus("absent")}
                >
                  <XIcon className="h-4 w-4" /> Mark Absent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy}
                  onClick={() => setBulkConfirm("clear")}
                >
                  <Trash2 className="h-4 w-4" /> Remove records
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={bulkBusy}
                  onClick={() => setBulkConfirm("deactivate")}
                >
                  <UserX className="h-4 w-4" /> Deactivate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={bulkBusy}
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                      aria-label="Select all visible members"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                      }}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const r of visibleRows) {
                            if (e.target.checked) next.add(r.member.id);
                            else next.delete(r.member.id);
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Marked</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => (
                  <tr
                    key={row.member.id}
                    className={selected.has(row.member.id) ? "bg-brand-50/50" : "hover:bg-slate-50"}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                        aria-label={`Select ${row.member.fullName}`}
                        checked={selected.has(row.member.id)}
                        onChange={() => toggleSelected(row.member.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.member.fullName}</div>
                      {row.member.phoneNumber && (
                        <div className="text-xs text-slate-400">{row.member.phoneNumber}</div>
                      )}
                      {row.member.address && (
                        <div className="text-xs text-slate-400">{row.member.address}</div>
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
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      No members match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={bulkConfirm === "clear"}
        title="Remove attendance records"
        message={
          <>
            Remove the attendance records for{" "}
            <span className="font-semibold text-slate-800">{selected.size}</span> selected
            member(s) in this service? They will show as unmarked again.
          </>
        }
        confirmLabel="Remove records"
        destructive
        loading={bulkBusy}
        onConfirm={bulkClearRecords}
        onCancel={() => setBulkConfirm(null)}
      />

      <ConfirmDialog
        open={bulkConfirm === "deactivate"}
        title="Deactivate members"
        message={
          <>
            Deactivate <span className="font-semibold text-slate-800">{selected.size}</span>{" "}
            selected member(s)? They will be removed from this roster and the public attendance
            list until reactivated.
          </>
        }
        confirmLabel="Deactivate"
        destructive
        loading={bulkBusy}
        onConfirm={bulkDeactivate}
        onCancel={() => setBulkConfirm(null)}
      />
    </div>
  );
}
