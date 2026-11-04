import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

// Under Cache Components this route intentionally blocks on the server so the
// session cookie can be read to guard the whole admin area.
export const instant = false;

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminShell adminName={session.name} adminEmail={session.email}>
      {children}
    </AdminShell>
  );
}
