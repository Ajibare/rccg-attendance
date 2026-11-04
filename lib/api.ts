import "server-only";
import { NextResponse } from "next/server";

/* --------------------------- response helpers -------------------------- */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as unknown, { status: 200, ...init });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong. Please try again.") {
  return NextResponse.json({ error: message }, { status: 500 });
}

/* ------------------------ object id validation ------------------------ */

export function isValidObjectId(value: string | undefined | null): value is string {
  return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
}

/* ------------------------- string normalization ----------------------- */

/** Case-insensitive, whitespace-collapsed key used for duplicate detection. */
export function normalizeName(fullName: string): string {
  return fullName.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}
