"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Star, Pencil, Trash2, CalendarDays } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useLoader } from "@/lib/useLoader";
import type { ServiceDTO } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button, Spinner } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const toInputDate = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

export default function ServicesPage() {
  const [items, setItems] = useState<ServiceDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDTO | null>(null);
  const [form, setForm] = useState({ title: "", serviceDate: "", activate: false });
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState<ServiceDTO | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: ServiceDTO[] }>("/api/admin/services");
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useLoader(load, []);

  function openCreate() {
    setEditing(null);
    setForm({ title: "", serviceDate: toInputDate(new Date().toISOString()), activate: false });
    setModalOpen(true);
  }

  function openEdit(s: ServiceDTO) {
    setEditing(s);
    setForm({ title: s.title, serviceDate: toInputDate(s.serviceDate), activate: s.isActive });
    setModalOpen(true);
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Enter a service title.");
    if (!form.serviceDate) return toast.error("Choose a service date.");
    setSaving(true);
    const serviceDate = `${form.serviceDate}T12:00:00`;
    try {
      if (editing) {
        await apiFetch(`/api/admin/services/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: form.title.trim(),
            serviceDate,
            active: form.activate,
          }),
        });
        toast.success("Service updated.");
      } else {
        await apiFetch("/api/admin/services", {
          method: "POST",
          body: JSON.stringify({
            title: form.title.trim(),
            serviceDate,
            activate: form.activate,
          }),
        });
        toast.success("Service created.");
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save service.");
    } finally {
      setSaving(false);
    }
  }

  async function activate(s: ServiceDTO) {
    try {
      await apiFetch(`/api/admin/services/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: true }),
      });
      toast.success(`“${s.title}” is now the active service.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not activate service.");
    }
  }

  async function doDelete() {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      await apiFetch(`/api/admin/services/${confirm.id}`, { method: "DELETE" });
      toast.success("Service deleted.");
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete service.");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Attendance is organized by service. The active service is what members see."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Service
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 font-medium text-slate-700">No services yet</p>
          <p className="text-sm text-slate-500">Create a service to open attendance for members.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Service
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div
              key={s.id}
              className={`flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between ${
                s.isActive ? "border-brand-300 ring-1 ring-brand-100" : "border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{s.title}</span>
                  {s.isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      <Star className="h-3 w-3" /> Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {new Date(s.serviceDate).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!s.isActive && (
                  <Button size="sm" variant="secondary" onClick={() => activate(s)}>
                    Set Active
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirm(s)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Service" : "New Service"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save Changes" : "Create Service"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="s-title">Title</Label>
            <Input
              id="s-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Sunday Service"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="s-date">Service Date</Label>
            <Input
              id="s-date"
              type="date"
              value={form.serviceDate}
              onChange={(e) => setForm((f) => ({ ...f, serviceDate: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.activate}
              onChange={(e) => setForm((f) => ({ ...f, activate: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
            />
            Set as the active service
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Delete service"
        message={
          <>
            Delete <span className="font-semibold text-slate-800">{confirm?.title}</span> and all of
            its attendance records? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        loading={confirmLoading}
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
