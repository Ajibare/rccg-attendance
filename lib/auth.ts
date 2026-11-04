import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { connectDB } from "./db";
import { Admin } from "./models/Admin";

export const AUTH_COOKIE = "rccg_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AdminSession {
  id: string;
  email: string;
  name: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Configure it in .env.local.");
  }
  return new TextEncoder().encode(secret);
}

/* ----------------------------- passwords ----------------------------- */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/* ------------------------------- tokens ------------------------------ */

export async function createSession(admin: AdminSession): Promise<void> {
  const token = await new SignJWT({ email: admin.email, name: admin.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}

/**
 * Verifies the session cookie and returns the admin, or null when the
 * cookie is missing / invalid. Used by every protected route handler.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

/* ------------------------------ seeding ------------------------------ */

/**
 * Idempotently creates the initial admin from environment variables.
 * Safe to call on every login attempt.
 */
export async function ensureAdminSeeded(): Promise<void> {
  await connectDB();

  const existing = await Admin.findOne({}).lean();
  if (existing) return;

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "No admin exists and ADMIN_EMAIL/ADMIN_PASSWORD are not configured."
    );
  }

  const passwordHash = await hashPassword(password);
  await Admin.create({
    name: "Administrator",
    email,
    password: passwordHash,
  });
}
