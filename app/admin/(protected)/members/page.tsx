"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Search, Pencil, Trash2, UserX, UserCheck } from "lucide-react";
import { apiFetch } from "@/lib/client";
import type { MemberDTO } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button, Spinner } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function MembersPage() {
  const [items, setItems] = useState<MemberDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MemberDTO | null>(null);
  const [form, setForm] = useState({ fullName: "", phoneNumber: "", address: "" });
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState<MemberDTO | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<null | "delete" | "deactivate">(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status === "active") params.set("isActive", "true");
      if (status === "inactive") params.set("isActive", "false");
      const res = await apiFetch<{ items: MemberDTO[] }>(
        `/api/admin/members?${params.toString()}`
      );
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ fullName: "", phoneNumber: "", address: "" });
    setModalOpen(true);
  }

  function openEdit(m: MemberDTO) {
    setEditing(m);
    setForm({ fullName: m.fullName, phoneNumber: m.phoneNumber ?? "", address: m.address ?? "" });
    setModalOpen(true);
  }

  async function save() {
    if (form.fullName.trim().length < 2) {
      toast.error("Enter a full name.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/admin/members/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            phoneNumber: form.phoneNumber.trim(),
            address: form.address.trim(),
          }),
        });
        toast.success("Member updated.");
      } else {
        await apiFetch("/api/admin/members", {
          method: "POST",
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            phoneNumber: form.phoneNumber.trim(),
            address: form.address.trim(),
          }),
        });
        toast.success("Member created.");
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save member.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: MemberDTO) {
    try {
      await apiFetch(`/api/admin/members/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      toast.success(m.isActive ? "Member deactivated." : "Member reactivated.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update member.");
    }
  }

  async function doDelete() {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      await apiFetch(`/api/admin/members/${confirm.id}`, { method: "DELETE" });
      toast.success("Member deleted.");
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete member.");
    } finally {
      setConfirmLoading(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkSetActive(isActive: boolean) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await apiFetch("/api/admin/members/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids, isActive }),
      });
      toast.success(`${ids.length} member(s) ${isActive ? "reactivated" : "deactivated"}.`);
      setBulkConfirm(null);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update members.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await apiFetch<{ deleted: number; attendanceDeleted: number }>(
        "/api/admin/members/bulk",
        { method: "DELETE", body: JSON.stringify({ ids }) }
      );
      toast.success(`${res.deleted} member(s) deleted.`);
      setBulkConfirm(null);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete members.");
    } finally {
      setBulkBusy(false);
    }
  }

  const allSelected = items.length > 0 && items.every((m) => selected.has(m.id));
  const someSelected = items.some((m) => selected.has(m.id));

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${items.length} shown`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Member
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(new Set());
            }}
            placeholder="Search by name, phone or address…"
            className="pl-9"
          />
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setSelected(new Set());
              }}
              className={`rounded-md px-3 py-1.5 capitalize ${
                status === s ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-brand-900">{selected.size} selected</p>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => bulkSetActive(true)}
            >
              <UserCheck className="h-4 w-4" /> Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => setBulkConfirm("deactivate")}
            >
              <UserX className="h-4 w-4" /> Deactivate
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={bulkBusy}
              onClick={() => setBulkConfirm("delete")}
            >
              <Trash2 className="h-4 w-4" /> Delete
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
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No members found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                    aria-label="Select all members"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const m of items) {
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                        }
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((m) => (
                <tr
                  key={m.id}
                  className={selected.has(m.id) ? "bg-brand-50/50" : "hover:bg-slate-50"}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                      aria-label={`Select ${m.fullName}`}
                      checked={selected.has(m.id)}
                      onChange={() => toggleSelected(m.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{m.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{m.phoneNumber || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{m.address || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Edit" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        title={m.isActive ? "Deactivate" : "Reactivate"}
                        onClick={() => toggleActive(m)}
                      >
                        {m.isActive ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </IconBtn>
                      <IconBtn title="Delete" danger onClick={() => setConfirm(m)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Member" : "Add Member"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save Changes" : "Create Member"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="m-name">Full Name</Label>
            <Input
              id="m-name"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="m-phone">
              Phone Number <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="m-phone"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              inputMode="tel"
            />
          </div>
          <div>
            <Label htmlFor="m-address">
              Address <span className="text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="m-address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={2}
              placeholder="e.g. 12 Allen Avenue, Ikeja, Lagos"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Delete member"
        message={
          <>
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-slate-800">{confirm?.fullName}</span>? This also
            removes their attendance records and cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        loading={confirmLoading}
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={bulkConfirm === "delete"}
        title="Delete members"
        message={
          <>
            Permanently delete <span className="font-semibold text-slate-800">{selected.size}</span>{" "}
            selected member(s)? This also removes their attendance records and cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        loading={bulkBusy}
        onConfirm={bulkDelete}
        onCancel={() => setBulkConfirm(null)}
      />

      <ConfirmDialog
        open={bulkConfirm === "deactivate"}
        title="Deactivate members"
        message={
          <>
            Deactivate <span className="font-semibold text-slate-800">{selected.size}</span>{" "}
            selected member(s)? They will stop appearing on the roster and public attendance list
            until reactivated.
          </>
        }
        confirmLabel="Deactivate"
        loading={bulkBusy}
        onConfirm={() => bulkSetActive(false)}
        onCancel={() => setBulkConfirm(null)}
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-md p-1.5 ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
