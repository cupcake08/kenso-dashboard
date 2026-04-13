"use client";

import { useApi } from "./use-api";
import type { UsageResponse } from "@/types/api";

export function useSubscription() {
  const { data, error, isLoading } = useApi<UsageResponse>("/usage");

  const isAnalyzeTier = data?.plan_id === "analyze";
  const isListenTier = data?.plan_id === "listen" || (!data?.plan_id && !isLoading);
  const hasAnalysis = isAnalyzeTier;
  const remainingHours = data?.remaining_hours ?? 0;
  const hasCredits = (data?.pool_balance_minutes ?? 0) > 0;

  return {
    data,
    isLoading,
    error,
    isAnalyzeTier,
    isListenTier,
    hasAnalysis,
    remainingHours,
    hasCredits,
    planName: data?.plan_display_name ?? "Free",
    commitmentLevel: data?.commitment_level ?? "monthly",
  };
}
