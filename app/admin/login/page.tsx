"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LockKeyhole } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      toast.success("Signed in");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <Image
            src="/rccg-logo.png"
            alt="RCCG logo"
            width={48}
            height={48}
            priority
            className="h-12 w-12 rounded-full bg-white object-cover"
          />
          <h1 className="mt-3 text-lg font-bold">RCCG YAYA</h1>
          <p className="text-sm text-brand-200">Admin Dashboard</p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-xl"
        >
          <div className="flex items-center gap-2 text-slate-800">
            <LockKeyhole className="h-5 w-5 text-brand-700" />
            <h2 className="font-semibold">Sign in</h2>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            Sign In
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-brand-200">
          Authorized administrators only.
        </p>
      </div>
    </div>
  );
}
