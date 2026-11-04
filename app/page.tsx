"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Search, UserPlus, Users, CheckCircle2, Church } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useLoader } from "@/lib/useLoader";
import type { PublicRow, AttendanceSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";

type ActiveResp = {
  service: { id: string; title: string; serviceDate: string } | null;
  rows: PublicRow[];
  summary: AttendanceSummary;
};

export default function AttendancePage() {
  const [data, setData] = useState<ActiveResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regSaving, setRegSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<ActiveResp>("/api/service/active");
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useLoader(load, []);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [data, query]);

  async function markPresent(memberId: string) {
    setBusyId(memberId);
    try {
      const res = await apiFetch<{ status: string; alreadyMarked: boolean }>(
        "/api/attendance",
        { method: "POST", body: JSON.stringify({ memberId }) }
      );
      if (res.alreadyMarked) {
        toast("You are already marked present for this service.");
      } else {
        toast.success("You are marked present. God bless you!");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitRegistration() {
    if (regName.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    setRegSaving(true);
    try {
      const res = await apiFetch<{ id: string; fullName: string }>(
        "/api/members",
        {
          method: "POST",
          body: JSON.stringify({
            fullName: regName.trim(),
            phoneNumber: regPhone.trim() || undefined,
          }),
        }
      );
      toast.success("Welcome! Your name has been added.");
      setRegisterOpen(false);
      setRegName("");
      setRegPhone("");
      await load();
      // Immediately offer to mark present for the freshly registered member.
      markPresent(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed. Try again.");
    } finally {
      setRegSaving(false);
    }
  }

  const serviceDateLabel = data?.service
    ? new Date(data.service.serviceDate).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-brand-800 text-white">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <Church className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">
                RCCG YAYA
              </p>
              <h1 className="text-xl font-bold sm:text-2xl">Church Attendance</h1>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/15">
            {loading ? (
              <span className="text-brand-100">Loading current service…</span>
            ) : data?.service ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{data.service.title}</span>
                <span className="text-brand-100">{serviceDateLabel}</span>
              </div>
            ) : (
              <span className="text-brand-100">
                No active service right now. Please check back shortly.
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Welcome */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Welcome to RCCG YAYA
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Please find your name on the attendance list and mark yourself present.
          </p>
        </section>

        {/* Present counter */}
        {data?.service && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Users className="h-5 w-5 text-brand-700" />
            <span className="text-sm text-slate-600">Total present:</span>
            <span className="ml-auto text-lg font-bold text-brand-800">
              {data.summary.present}
            </span>
            <span className="text-xs text-slate-400">/ {data.summary.totalMembers} members</span>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your name…"
            className="h-12 pl-10 text-base"
            aria-label="Search members"
          />
        </div>

        {/* List */}
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" className="mt-3" onClick={load}>
              Retry
            </Button>
          </div>
        ) : !data?.service ? (
          <EmptyState
            title="No active service"
            message="Attendance is not open yet. Please try again later."
          />
        ) : data.rows.length === 0 ? (
          <EmptyState
            title="No members yet"
            message="Add your name below to get started."
          />
        ) : (
          <ul className="space-y-2">
            {filtered.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                  {row.fullName}
                </span>
                {row.status === "present" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-4 w-4" /> Present
                  </span>
                ) : (
                  <Button
                    size="md"
                    variant="success"
                    loading={busyId === row.id}
                    onClick={() => markPresent(row.id)}
                  >
                    Mark Present
                  </Button>
                )}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                No names match “{query}”.
              </li>
            )}
          </ul>
        )}

        {/* Not found helper */}
        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-4">
          <p className="text-sm text-brand-900">
            Can’t find your name on the list?
          </p>
          <Button
            variant="primary"
            className="mt-2 w-full sm:w-auto"
            onClick={() => setRegisterOpen(true)}
          >
            <UserPlus className="h-4 w-4" /> Add My Name
          </Button>
        </div>

        <footer className="mt-8 pb-6 text-center text-xs text-slate-400">
          RCCG YAYA · Attendance Management
        </footer>
      </main>

      {/* Registration modal */}
      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Add My Name"
        footer={
          <>
            <Button variant="outline" onClick={() => setRegisterOpen(false)} disabled={regSaving}>
              Cancel
            </Button>
            <Button onClick={submitRegistration} loading={regSaving}>
              Save &amp; Mark Present
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="e.g. John Okafor"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="phone">
              Phone Number <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="phone"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              placeholder="e.g. 08012345678"
              inputMode="tel"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
        />
      ))}
    </ul>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}
