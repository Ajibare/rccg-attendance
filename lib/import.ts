import "server-only";
import * as XLSX from "xlsx";
import { connectDB } from "./db";
import { Member } from "./models/Member";
import { normalizeName, normalizePhone } from "./api";

export type ParsedRow = {
  index: number;
  fullName: string;
  phoneNumber: string;
};

export type PreviewRow = ParsedRow & {
  /** "duplicate" if it matches an existing member or an earlier row in the file. */
  duplicateOf?: "existing" | "file";
  existingMatchName?: string;
  valid: boolean;
};

const NAME_KEYS = ["name", "full name", "fullname", "member name", "member", "full", "individual"];
const PHONE_KEYS = ["phone", "phone number", "phonenumber", "mobile", "cell", "tel", "telephone", "number", "contact"];

/** Parses an uploaded CSV/Excel buffer into a list of { fullName, phoneNumber }. */
export function parseMemberFile(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  if (rows.length === 0) return [];

  let nameCol = 0;
  let phoneCol: number | undefined;
  let startIdx = 0;

  const header = (rows[0] as unknown[]).map((c) => String(c).trim().toLowerCase());
  const nameIdx = header.findIndex((h) => NAME_KEYS.some((k) => h === k || h.includes(k)));
  const phoneIdx = header.findIndex((h) => PHONE_KEYS.some((k) => h === k || h.includes(k)));

  if (nameIdx !== -1 || phoneIdx !== -1) {
    // Treat first row as header.
    nameCol = nameIdx !== -1 ? nameIdx : 0;
    phoneCol = phoneIdx !== -1 ? phoneIdx : undefined;
    startIdx = 1;
  } else {
    // No recognizable header: first column = name, second column (if present) = phone.
    const width = Math.max(...rows.map((r) => (r as unknown[]).length));
    nameCol = 0;
    phoneCol = width >= 2 ? 1 : undefined;
    startIdx = 0;
  }

  const out: ParsedRow[] = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const fullName = String(r[nameCol] ?? "").trim();
    const phoneNumber = phoneCol !== undefined ? String(r[phoneCol] ?? "").trim() : "";
    if (!fullName) continue;
    out.push({ index: i, fullName, phoneNumber });
  }
  return out;
}

/**
 * Marks duplicates within the file and against existing active members.
 * Does NOT persist anything.
 */
export async function annotateDuplicates(parsed: ParsedRow[]): Promise<PreviewRow[]> {
  await connectDB();

  const existing = await Member.find({ isActive: true })
    .select("fullName phoneNumber")
    .exec();

  const existingNames = new Map<string, string>();
  const existingPhones = new Map<string, string>();
  for (const m of existing) {
    existingNames.set(normalizeName(m.fullName), m.fullName);
    if (m.phoneNumber) existingPhones.set(normalizePhone(m.phoneNumber), m.fullName);
  }

  const seenNames = new Set<string>();
  const seenPhones = new Set<string>();

  return parsed.map((row) => {
    const nKey = normalizeName(row.fullName);
    const pKey = row.phoneNumber ? normalizePhone(row.phoneNumber) : "";

    let duplicateOf: PreviewRow["duplicateOf"];
    let existingMatchName: string | undefined;

    if (seenNames.has(nKey) || (pKey && seenPhones.has(pKey))) {
      duplicateOf = "file";
    } else if (existingNames.has(nKey)) {
      duplicateOf = "existing";
      existingMatchName = existingNames.get(nKey);
    } else if (pKey && existingPhones.has(pKey)) {
      duplicateOf = "existing";
      existingMatchName = existingPhones.get(pKey);
    }

    seenNames.add(nKey);
    if (pKey) seenPhones.add(pKey);

    return {
      ...row,
      duplicateOf,
      existingMatchName,
      valid: row.fullName.trim().length >= 2,
    };
  });
}

/** Persists new (non-duplicate) members. Returns import/skip counts. */
export async function commitImport(
  rows: { fullName: string; phoneNumber?: string }[]
): Promise<{ imported: number; skipped: number }> {
  await connectDB();

  const existing = await Member.find({ isActive: true }).select("fullName phoneNumber").exec();
  const existingNames = new Set(existing.map((m) => normalizeName(m.fullName)));
  const existingPhones = new Set(
    existing.map((m) => m.phoneNumber && normalizePhone(m.phoneNumber)).filter(Boolean) as string[]
  );

  const toCreate: { fullName: string; phoneNumber?: string }[] = [];
  const batchNames = new Set<string>();
  const batchPhones = new Set<string>();
  let skipped = 0;

  for (const raw of rows) {
    const fullName = String(raw.fullName ?? "").trim();
    const phoneNumber = raw.phoneNumber ? normalizePhone(String(raw.phoneNumber)) : "";
    const nKey = normalizeName(fullName);

    if (
      fullName.length < 2 ||
      existingNames.has(nKey) ||
      batchNames.has(nKey) ||
      (phoneNumber && (existingPhones.has(phoneNumber) || batchPhones.has(phoneNumber)))
    ) {
      skipped++;
      continue;
    }

    batchNames.add(nKey);
    if (phoneNumber) batchPhones.add(phoneNumber);
    toCreate.push({ fullName, phoneNumber: phoneNumber || undefined });
  }

  if (toCreate.length > 0) {
    await Member.insertMany(toCreate.map((c) => ({ ...c, isActive: true })));
  }

  return { imported: toCreate.length, skipped };
}
