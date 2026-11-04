import "server-only";
import { getAdminSession, AdminSession } from "./auth";
import { unauthorized } from "./api";

export type AdminGuard =
  | { session: AdminSession; error?: never }
  | { session?: never; error: Response };

/** Verifies the admin session cookie for a route handler. */
export async function requireAdmin(): Promise<AdminGuard> {
  const session = await getAdminSession();
  if (!session) {
    return { error: unauthorized("Please sign in to continue.") };
  }
  return { session };
}
