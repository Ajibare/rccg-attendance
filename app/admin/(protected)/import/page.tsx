"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Upload, FileText, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { apiFetch } from "@/lib/client";
import type { PreviewRow } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button, Spinner } from "@/components/ui/Button";

type PreviewResp = {
  total: number;
  duplicates: number;
  importable: number;
  rows: PreviewRow[];
};

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function handleFile(file: File) {
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      toast.error("Please choose a CSV or Excel file.");
      return;
    }
    setUploading(true);
    setResult(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch<PreviewResp>("/api/admin/import?action=preview", {
        method: "POST",
        body: fd,
      });
      setPreview(res);
      if (res.total === 0) toast("No member rows were found in that file.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function commit() {
    if (!preview) return;
    const rows = preview.rows
      .filter((r) => !r.duplicateOf && r.valid)
      .map((r) => ({ fullName: r.fullName, phoneNumber: r.phoneNumber }));
    if (rows.length === 0) {
      toast.error("There are no new members to import.");
      return;
    }
    setCommitting(true);
    try {
      const res = await apiFetch<{ imported: number; skipped: number }>(
        "/api/admin/import?action=commit",
        { method: "POST", body: JSON.stringify({ rows }) }
      );
      setResult(res);
      toast.success(`Imported ${res.imported} member(s).`);
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Import Members"
        subtitle="Upload an existing member list (CSV or Excel). We detect duplicates automatically."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-brand-400 hover:bg-brand-50/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              {uploading ? (
                <Spinner className="h-7 w-7 text-brand-600" />
              ) : (
                <Upload className="h-8 w-8 text-slate-400" />
              )}
              <span className="mt-3 text-sm font-medium text-slate-700">
                Click to choose a file or drag it here
              </span>
              <span className="mt-1 text-xs text-slate-400">
                CSV or Excel · include a name column, optional phone column
              </span>
            </label>

            {result && (
              <div className="mt-5 flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-medium">Import complete.</p>
                  <p className="text-emerald-700">
                    {result.imported} added · {result.skipped} skipped as duplicates. New members now
                    appear on the public page.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800">
                <FileText className="h-4 w-4" /> Expected format
              </h3>
              <a
                href="/sample-members.csv"
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              >
                <Download className="h-3.5 w-3.5" /> Download CSV sample
              </a>
            </div>
            <p className="mb-2">Your file should have columns like:</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
{`Full Name, Phone Number
John Okafor, 08012345678
Mary Ade, 08098765432`}
            </pre>
            <p className="mt-2 text-xs text-slate-400">
              The phone column is optional. Header names are auto-detected; if none are found the
              first column is treated as names.
            </p>
          </div>
        </div>
      </div>

      {preview && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Preview</h3>
              <p className="text-sm text-slate-500">
                {preview.total} rows · <span className="text-emerald-700">{preview.importable} new</span>{" "}
                · <span className="text-amber-700">{preview.duplicates} duplicates</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={committing}>
                Cancel
              </Button>
              <Button onClick={commit} loading={committing} disabled={preview.importable === 0}>
                Import {preview.importable} member(s)
              </Button>
            </div>
          </div>

          {preview.duplicates > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 px-5 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Rows marked “duplicate” already exist and will be skipped.
            </div>
          )}

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-5 py-2 font-medium">Phone</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((r, i) => (
                  <tr key={`${r.index}-${i}`} className={r.duplicateOf ? "bg-amber-50/40" : ""}>
                    <td className="px-5 py-2 text-slate-800">{r.fullName}</td>
                    <td className="px-5 py-2 text-slate-500">{r.phoneNumber || "—"}</td>
                    <td className="px-5 py-2">
                      {r.duplicateOf === "existing" ? (
                        <span className="text-xs font-medium text-amber-700">
                          Duplicate of {r.existingMatchName}
                        </span>
                      ) : r.duplicateOf === "file" ? (
                        <span className="text-xs font-medium text-amber-700">Duplicate in file</span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700">New</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
