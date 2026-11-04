"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ShieldCheck, CalendarDays, Users, LogOut } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useLoader } from "@/lib/useLoader";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button, Spinner } from "@/components/ui/Button";
import type { Overview } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<{ name: string; email: string } | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [session, stats] = await Promise.all([
        apiFetch<{ name: string; email: string }>("/api/admin/session"),
        apiFetch<Overview>("/api/admin/overview"),
      ]);
      setAdmin(session);
      setOverview(stats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useLoader(load, []);

  async function logout() {
    try {
      await apiFetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out.");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account and application information." />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <ShieldCheck className="h-4 w-4 text-brand-700" /> Administrator
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-800">{admin?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-800">{admin?.email}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            The initial administrator is created from server environment variables. Credentials are
            never stored or exposed in the frontend.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <CalendarDays className="h-4 w-4 text-brand-700" /> Current Service
          </h3>
          {overview?.service ? (
            <>
              <p className="font-medium text-slate-800">{overview.service.title}</p>
              <p className="text-sm text-slate-500">
                {new Date(overview.service.serviceDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                <Users className="h-4 w-4 text-slate-400" />
                {overview.totalMembers} members · {overview.present} present
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No active service yet.</p>
          )}
          <Link
            href="/admin/services"
            className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            Manage services →
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-slate-800">Session</h3>
        <Button variant="danger" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
