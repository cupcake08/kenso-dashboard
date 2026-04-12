"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { useAuthReady } from "./use-auth-ready";
import { apiFetch } from "@/lib/api";

/** SWR hook gated on Firebase Auth readiness. Key is null until auth initializes. */
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
