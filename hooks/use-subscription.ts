"use client";

import { useApi } from "./use-api";
import type { UsageResponse } from "@/types/api";

export function useSubscription() {
  const { data, error, isLoading } = useApi<UsageResponse>("/usage");

  const loaded = !!data && !error;
  const subState = data?.subscription_state ?? "";

  // Plan tier checks
  const isAnalyzeTier = loaded && data.plan_id === "analyze";
  const isListenTier = loaded && data.plan_id === "listen";

  // Analysis access: analyze tier OR trialing (trial always has full features).
  // During trial, plan_id might not be "analyze" if plans weren't seeded,
  // but the subscription state IS "trialing" which grants all features.
  const isTrialing = subState === "trialing";
  const hasAnalysis = loaded
    ? isAnalyzeTier || isTrialing
    : !isLoading ? undefined : undefined;

  const remainingHours = data?.remaining_hours ?? 0;
  const hasCredits = (data?.pool_balance_minutes ?? 0) > 0;

  return {
    data,
    isLoading,
    error,
    /** true = analyze/trialing, false = listen/no-plan, undefined = loading/error */
    hasAnalysis,
    isAnalyzeTier,
    isListenTier,
    isTrialing,
    remainingHours,
    hasCredits,
    planName: data?.plan_display_name ?? (isLoading ? "" : ""),
    commitmentLevel: data?.commitment_level ?? "monthly",
    subscriptionState: subState,
  };
}
