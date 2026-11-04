"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Users, UserCheck, UserX, UserPlus, Percent, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useLoader } from "@/lib/useLoader";
import type { Overview } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Button";

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<Overview>("/api/admin/overview");
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useLoader(load, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          data?.service
            ? `Active service: ${data.service.title} · ${new Date(
                data.service.serviceDate
              ).toLocaleDateString()}`
            : "No active service yet"
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          {error}
          <div>
            <Button variant="outline" className="mt-3" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Registered Members" value={data?.totalMembers ?? 0} icon={Users} />
          <StatCard label="Present" value={data?.present ?? 0} icon={UserCheck} accent="green" />
          <StatCard label="Absent" value={data?.absent ?? 0} icon={UserX} accent="slate" />
          <StatCard label="New Members (30d)" value={data?.newMembers ?? 0} icon={UserPlus} accent="amber" />
        </div>
      )}

      {data && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
            <div className="flex items-center gap-2 text-slate-500">
              <Percent className="h-4 w-4" />
              <span className="text-sm font-medium">Attendance rate</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-brand-800">{data.percentage}%</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${data.percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {data.present} of {data.totalMembers} members present
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-700">Quick actions</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <QuickLink href="/admin/services" label="Create / manage services" />
              <QuickLink href="/admin/import" label="Upload member list" />
              <QuickLink href="/admin/attendance" label="Take attendance" />
              <QuickLink href="/admin/members" label="Manage members" />
            </div>
            {!data.service && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-200">
                Tip: create an active service so the public attendance page opens for members.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50"
    >
      {label}
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}
