import { NextRequest, NextResponse } from "next/server";
import {
  ensureAdminSeeded,
  verifyPassword,
  createSession,
} from "@/lib/auth";
import { Admin } from "@/lib/models/Admin";
import { badRequest, serverError, unauthorized } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    // Idempotently seed the initial admin from env on first use.
    await ensureAdminSeeded();

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) return badRequest("Email and password are required.");

    const admin = await Admin.findOne({ email }).exec();
    if (!admin) return unauthorized("Invalid email or password.");

    const valid = await verifyPassword(password, admin.password);
    if (!valid) return unauthorized("Invalid email or password.");

    await createSession({
      id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
    });

    return NextResponse.json({ ok: true, name: admin.name, email: admin.email });
  } catch (err) {
    console.error("POST /api/admin/login failed:", err);
    return serverError(
      "Unable to sign in. Please verify the server configuration and try again."
    );
  }
}
