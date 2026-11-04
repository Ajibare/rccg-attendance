import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { badRequest, serverError } from "@/lib/api";
import {
  parseMemberFile,
  annotateDuplicates,
  commitImport,
} from "@/lib/import";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/admin/import
 *  - ?action=preview (default): multipart/form-data with `file`. Returns parsed
 *    rows with duplicate detection, without saving.
 *  - ?action=commit: JSON { rows: [{fullName, phoneNumber?}] }. Saves new members.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const action = new URL(req.url).searchParams.get("action") ?? "preview";

  try {
    if (action === "commit") {
      const body = await req.json().catch(() => ({ rows: [] }));
      const rows: unknown[] = Array.isArray((body as { rows?: unknown[] }).rows)
        ? (body as { rows: unknown[] }).rows
        : [];
      const cleaned = rows.map((r: unknown) => ({
        fullName: String((r as { fullName?: string }).fullName ?? ""),
        phoneNumber: String((r as { phoneNumber?: string }).phoneNumber ?? ""),
      }));
      const result = await commitImport(cleaned);
      return NextResponse.json(result);
    }

    // preview
    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || typeof file === "string") {
      return badRequest("No file uploaded.");
    }
    if (file.size > MAX_BYTES) {
      return badRequest("File is too large (max 5 MB).");
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseMemberFile(buffer);
    const annotated = await annotateDuplicates(parsed);

    const duplicates = annotated.filter((r) => r.duplicateOf).length;
    const importable = annotated.filter((r) => !r.duplicateOf && r.valid).length;

    return NextResponse.json({
      total: annotated.length,
      duplicates,
      importable,
      rows: annotated,
    });
  } catch (err) {
    console.error("POST /api/admin/import failed:", err);
    return serverError("Could not process the uploaded file. Check the format and try again.");
  }
}
