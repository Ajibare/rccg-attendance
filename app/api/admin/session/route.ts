import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";

/** GET /api/admin/session — returns the signed-in admin's basic profile. */
export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  return NextResponse.json({ name: guard.session.name, email: guard.session.email });
}
