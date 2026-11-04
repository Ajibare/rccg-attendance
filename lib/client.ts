"use client";

/**
 * Thin fetch wrapper for client components.
 * - Parses JSON errors thrown by our route handlers into a readable message.
 * - Redirects to /admin/login when an admin API returns 401.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function toError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
  } catch {
    /* ignore */
  }
  return new ApiError(message, res.status);
}

export async function apiFetch<T = unknown>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 && input.startsWith("/api/admin")) {
      if (typeof window !== "undefined") {
        // Safety net: the server layout guard handles the normal case. This
        // catches direct API 401s (e.g. an expired session mid-interaction).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/admin/login");
      }
    }
    throw await toError(res);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Triggers a browser download from an export URL. */
export async function downloadFile(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw await toError(res);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "export";
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
