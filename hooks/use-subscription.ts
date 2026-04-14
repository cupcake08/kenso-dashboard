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

  // Subscription state checks
  const isTrialing = subState === "trialing";
  const isBlocked = ["trial_ended", "past_due", "suspended", "cancelled"].includes(subState);

  // Analysis access: (analyze tier OR trialing) AND not in a blocked state.
  // trial_ended/past_due/suspended/cancelled must block even if plan_id is "analyze".
  const hasAnalysis = loaded
    ? (isAnalyzeTier || isTrialing) && !isBlocked
    : undefined;

  const remainingHours = data?.remaining_hours ?? 0;
  const hasCredits = (data?.pool_balance_minutes ?? 0) > 0;

  return {
    data,
    isLoading,
    error,
    /** true = analyze/trialing + active, false = listen/no-plan/blocked, undefined = loading/error */
    hasAnalysis,
    isAnalyzeTier,
    isListenTier,
    isTrialing,
    /** true when subscription is in trial_ended/past_due/suspended/cancelled */
    isBlocked,
    remainingHours,
    hasCredits,
    planName: isTrialing ? "Free Trial"
      : subState === "trial_ended" ? "Trial Ended"
      : data?.plan_display_name || (isLoading ? "" : ""),
    commitmentLevel: data?.commitment_level ?? "monthly",
    subscriptionState: subState,
  };
}
