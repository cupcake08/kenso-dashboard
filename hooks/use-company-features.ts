"use client";
import { useApi } from "./use-api";
import { getCompanyFeatures } from "@/lib/api";

export function useCompanyFeatures() {
  const { data, error, isLoading } = useApi(
    "company/features",
    () => getCompanyFeatures(),
    { dedupingInterval: 60_000 }
  );
  return { features: data ?? {}, error, isLoading };
}
