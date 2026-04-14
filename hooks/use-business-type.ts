"use client";
import { useApi } from "./use-api";
import { getBusinessType, getBusinessTypeSuggestion } from "@/lib/api";

export function useBusinessType() {
  const { data, error, isLoading, mutate } = useApi(
    "company/business-type",
    () => getBusinessType(),
    { dedupingInterval: 60_000 }
  );
  return { state: data, error, isLoading, mutate };
}

export function useBusinessTypeSuggestion() {
  const { data, error, isLoading, mutate } = useApi(
    "company/business-type-suggestion",
    () => getBusinessTypeSuggestion(),
    { dedupingInterval: 60_000 }
  );
  return { suggestion: data, error, isLoading, mutate };
}
