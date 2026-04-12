"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { useAuthReady } from "./use-auth-ready";
import { apiFetch } from "@/lib/api";

/**
 * SWR-based data fetching hook with Firebase auth gating.
 *
 * Industry-standard stale-while-revalidate pattern:
 * - First load (no cache): isLoading=true → show shimmer
 * - Subsequent loads: cached data shown instantly, revalidates in background
 * - No shimmer flicker on tab switches, navigation, or re-mounts
 *
 * Auth gating: SWR key is null until Firebase Auth initializes, preventing
 * the "Not authenticated" race condition.
 *
 * Usage:
 *   // Simple
 *   const { data, isLoading } = useApi<Device[]>('/devices');
 *
 *   // With transformation
 *   const { data, isLoading } = useApi('/devices', async (url) => {
 *     const raw = await apiFetch<RawDevice[]>(url);
 *     return raw.map(normalizeDevice);
 *   });
 *
 *   // With polling
 *   const { data } = useApi<Device[]>('/devices', undefined, { refreshInterval: 30000 });
 *
 *   // Conditional fetch
 *   const { data } = useApi(selectedId ? `/devices/${selectedId}` : null);
 */
export function useApi<T>(
  path: string | null,
  fetcher?: (url: string) => Promise<T>,
  options?: SWRConfiguration<T>,
) {
  const { ready } = useAuthReady();
  const key = ready && path ? path : null;

  return useSWR<T>(
    key,
    fetcher ?? ((url: string) => apiFetch<T>(url)),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      ...options,
    },
  );
}
