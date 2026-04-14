"use client";
import useSWR from "swr";
import { getCompanyFeatures } from "@/lib/api";

export function useCompanyFeatures() {
  const { data, error, isLoading } = useSWR(
    "company/features",
    getCompanyFeatures,
    { dedupingInterval: 60_000 }
  );
  return { features: data ?? {}, error, isLoading };
}
