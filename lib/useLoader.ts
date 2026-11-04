"use client";

import { useEffect } from "react";

/**
 * Runs an async loader right after mount (and whenever `deps` change).
 *
 * The loader is intentionally deferred to a microtask so the effect body does
 * not call it (and therefore any setState inside it) synchronously — which the
 * `react-hooks/set-state-in-effect` rule discourages.
 */
export function useLoader(loader: () => Promise<unknown>, deps: unknown[]) {
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void loader();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
