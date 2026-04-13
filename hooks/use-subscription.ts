"use client";

import { useApi } from "./use-api";
import type { UsageResponse } from "@/types/api";

export function useSubscription() {
  const { data, error, isLoading } = useApi<UsageResponse>("/usage");

  // When data is unavailable (loading or error), don't make gating decisions.
  // hasAnalysis stays undefined so consumers can distinguish "unknown" from "blocked".
  const loaded = !!data && !error;
  const isAnalyzeTier = loaded && data.plan_id === "analyze";
  const isListenTier = loaded && data.plan_id === "listen";
  const hasAnalysis = loaded ? isAnalyzeTier : !isLoading ? undefined : undefined;
  const remainingHours = data?.remaining_hours ?? 0;
  const hasCredits = (data?.pool_balance_minutes ?? 0) > 0;

  return {
    data,
    isLoading,
    error,
    /** true = analyze tier, false = listen tier, undefined = unknown (loading/error) */
    hasAnalysis,
    isAnalyzeTier,
    isListenTier,
    remainingHours,
    hasCredits,
    planName: data?.plan_display_name ?? (isLoading ? "" : "Free"),
    commitmentLevel: data?.commitment_level ?? "monthly",
  };
}
