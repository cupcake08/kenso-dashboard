"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, RefreshCw, X, Clock, ArrowUpRight, ArrowDownRight, Receipt, CheckCircle2, AlertCircle, Layers, Sparkles, Mail } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, normalizeCredits } from "@/lib/api";
import type { Transaction, RawCreditsResponse, UsageResponse } from "@/types/api";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Demo data ----------------------------------------------------------------

const DEMO_USAGE: UsageResponse = {
  plan_id: "analyze_pro",
  plan_display_name: "Analyze Pro",
  commitment_level: "Annual",
  total_devices: 3,
  analyze_devices: 3,
  listen_devices: 0,
  included_hours_per_device: 100,
  total_included_hours: 300,
  used_hours: 22.5,
  remaining_hours: 277.5,
  usage_percent: 7.5,
  monthly_rate_per_device_inr: 999,
  overage_rate_per_hour_inr: 40,
  total_monthly_inr: 2997,
  pool_balance_minutes: 16650,
  pool_period: "2026-04",
  subscription_state: "active",
  period_start: new Date(Date.now() - 13 * 86400000).toISOString(),
  period_end: new Date(Date.now() + 17 * 86400000).toISOString(),
};

const DEMO_CREDITS = { balance: 16650, balanceHours: 277.5, overageRatePerHourInr: 40, subscriptionState: "active" as const, transactions: [
  { id: "txn_001", type: "topup" as const, amount: 18000, description: "Monthly pool reset", created_at: new Date(Date.now() - 13 * 86400000).toISOString() },
  { id: "txn_002", type: "analysis" as const, amount: -900, description: "Audio analysis — Lobby Mic", created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: "txn_003", type: "analysis" as const, amount: -450, description: "Audio analysis — Counter Mic", created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
]};

// Hour-based top-up options: [hours, cost_inr]
const TOPUP_OPTIONS: [number, number][] = [
  [10, 400],
  [25, 1000],
  [50, 2000],
  [100, 4000],
];

// ── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target * 10) / 10);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

// ── TransactionItem ────────────────────────────────────────────────────────

function TransactionItem({ txn }: { txn: Transaction }) {
  const isPositive = txn.amount > 0;
  const hours = Math.abs(txn.amount / 60);
  const hoursLabel = hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(hours * 60)}m`;
  return (
    <div className="flex items-center gap-4 px-4 py-4 sm:px-5 hover:bg-muted/10 transition-colors">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        isPositive ? "bg-emerald-500/10" : "bg-blue-500/10"
      }`}>
        {isPositive
          ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          : <ArrowDownRight className="h-4 w-4 text-blue-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {txn.type === "topup" ? "Hours Top Up" : txn.type === "analysis" ? "Audio Analysis" : txn.type}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {txn.description || "\u2014"}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-base font-semibold tabular-nums leading-tight ${
          isPositive ? "text-emerald-400" : "text-foreground"
        }`}>
          {isPositive ? "+" : "-"}{hoursLabel}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">
          {formatDate(txn.created_at)}
        </p>
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Contact channel for upgrade requests. Update when a real support address
// is set up.
const UPGRADE_CONTACT_EMAIL = "support@knownsense.ai";

export default function UsagePage() {
  const [showTopup, setShowTopup] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedHours, setSelectedHours] = useState(25);
  const [topupStatus, setTopupStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  // Usage + credits revalidate when the tab regains focus — admin approvals
  // happen in a separate session, so customers need a way to see fresh values
  // without a hard reload. `dedupingInterval: 5000` prevents focus spam from
  // firing redundant fetches.
  const billingSwrConfig = {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  };

  // Usage breakdown from new endpoint
  const { data: usage, isLoading: usageLoading, error: usageError, mutate: mutateUsage } = useApi<UsageResponse>(
    isDemoMode ? null : "/usage",
    undefined,
    { fallbackData: isDemoMode ? DEMO_USAGE : undefined, ...billingSwrConfig },
  );

  // Credits — balance + transaction history
  const { data: credits, isLoading: creditsLoading, error: creditsError, mutate: mutateCredits } = useApi<ReturnType<typeof normalizeCredits>>(
    isDemoMode ? null : "/credits",
    async (url) => {
      const raw = await apiFetch<RawCreditsResponse>(url);
      return normalizeCredits(raw);
    },
    { fallbackData: isDemoMode ? DEMO_CREDITS : undefined, ...billingSwrConfig },
  );

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([mutateUsage(), mutateCredits()]);
    } finally {
      setRefreshing(false);
    }
  }

  const transactions = credits?.transactions ?? [];
  const loading = usageLoading || creditsLoading;
  const error = (usageError ?? creditsError)?.message ?? "";

  // Animated remaining hours counter
  const remainingHours = usage?.remaining_hours ?? 0;
  const countedHours = useCountUp(remainingHours);

  async function handleTopup() {
    setTopupStatus("submitting");
    const minutes = selectedHours * 60; // convert to credits (minutes)
    try {
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 800));
        setTopupStatus("success");
        toast.success(`${selectedHours}h top-up requested`);
        setTimeout(() => { setTopupStatus("idle"); setShowTopup(false); }, 1500);
        return;
      }
      await apiFetch("/credits/topup", {
        method: "POST",
        body: JSON.stringify({ amount: minutes }),
      });
      await Promise.all([mutateCredits(), mutateUsage()]);
      setTopupStatus("success");
      toast.success(`${selectedHours}h top-up requested`);
      setTimeout(() => { setTopupStatus("idle"); setShowTopup(false); }, 1500);
    } catch {
      setTopupStatus("error");
      toast.error("Failed to submit top-up request");
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-8">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error && !usage) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Usage</h1>
        <p className="text-sm text-muted-foreground mb-6">Hours and billing for your organization</p>
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-red-400">Unable to load usage data</p>
          <Button variant="ghost" size="sm" onClick={() => { mutateUsage(); mutateCredits(); }} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const usagePercent = Math.min(usage?.usage_percent ?? 0, 100);
  const totalIncluded = usage?.total_included_hours ?? 0;
  const usedHours = usage?.used_hours ?? 0;
  const overageRate = usage?.overage_rate_per_hour_inr ?? 40;
  const commitmentBadge = usage?.commitment_level ?? "";

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hours and billing for your organization</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Refresh usage data"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Hero: remaining hours */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.33, 1, 0.68, 1] }}
      >
        <div className="rounded-xl border border-border bg-card/60 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Hours Remaining</p>
              </div>
              <p className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight text-foreground leading-none">
                {countedHours.toFixed(1)}h
              </p>
              {remainingHours > totalIncluded && totalIncluded > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {totalIncluded}h included this month
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className="text-emerald-400 font-medium tabular-nums">
                    +{(remainingHours - totalIncluded).toFixed(1)}h
                  </span>{" "}
                  top-up balance
                </p>
              ) : totalIncluded > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  of {totalIncluded}h included this month
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Available pool</p>
              )}

              {/* Progress bar */}
              <div className="mt-4 h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground/60 tabular-nums">
                <span>{usedHours.toFixed(1)}h used</span>
                <span>{usagePercent.toFixed(1)}%</span>
              </div>
            </div>

            {usage?.subscription_state === "active" && (
              <Button
                onClick={() => setShowTopup(true)}
                size="lg"
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Top Up
              </Button>
            )}
            {(usage?.subscription_state === "trialing" || usage?.subscription_state === "trial_ended") && (
              <Button
                onClick={() => setShowUpgrade(true)}
                size="lg"
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Trial status banner */}
      {usage?.subscription_state === "trialing" && credits?.trialEndsAt && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-3.5 flex items-center gap-3"
        >
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Free trial — {(() => {
                const days = Math.max(0, Math.ceil((new Date(credits.trialEndsAt).getTime() - Date.now()) / 86400000));
                return days === 1 ? "1 day left" : `${days} days left`;
              })()}
            </p>
            <p className="text-xs text-muted-foreground">
              Ready to continue? Contact our team to activate your full plan.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowUpgrade(true)} className="shrink-0">
            Upgrade
          </Button>
        </motion.div>
      )}
      {usage?.subscription_state === "trial_ended" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-5 py-3.5 flex items-center gap-3"
        >
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Trial ended</p>
            <p className="text-xs text-muted-foreground">
              Contact our team to activate your full plan and keep analyzing audio.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowUpgrade(true)} className="shrink-0">
            Upgrade
          </Button>
        </motion.div>
      )}

      {/* Plan info card */}
      {usage && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: [0.33, 1, 0.68, 1] }}
        >
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Plan</p>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-base font-semibold text-foreground">{usage.plan_display_name}</p>
              {commitmentBadge && (
                <span className="text-[0.6875rem] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {commitmentBadge}
                </span>
              )}
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground font-medium tabular-nums">{usage.analyze_devices}</span> Analyze{" "}
                {usage.analyze_devices !== 1 ? "devices" : "device"}{" "}
                &times; <span className="text-foreground font-medium tabular-nums">{usage.included_hours_per_device}h</span>{" "}
                = <span className="text-foreground font-medium tabular-nums">{usage.total_included_hours}h</span>/month
              </p>
              {usage.listen_devices > 0 && (
                <p>
                  <span className="text-foreground font-medium tabular-nums">{usage.listen_devices}</span> Listen{" "}
                  {usage.listen_devices !== 1 ? "devices" : "device"}
                </p>
              )}
              <p className="pt-1 text-base font-semibold text-foreground">
                ₹{usage.total_monthly_inr.toLocaleString("en-IN")}/month
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Usage details */}
      {usage && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.33, 1, 0.68, 1] }}
        >
          <div className="rounded-xl border border-border bg-card/30 divide-y divide-border/50 overflow-hidden">
            <div className="flex justify-between px-5 py-3.5 text-sm">
              <span className="text-muted-foreground">Used this period</span>
              <span className="text-foreground tabular-nums font-medium">{usedHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between px-5 py-3.5 text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="text-foreground tabular-nums font-medium">{(usage.remaining_hours ?? 0).toFixed(1)}h</span>
            </div>
            <div className="flex justify-between px-5 py-3.5 text-sm">
              <span className="text-muted-foreground">Overage rate</span>
              <span className="text-foreground tabular-nums font-medium">₹{overageRate}/hour beyond included</span>
            </div>
            {usage.period_start && usage.period_end && (
              <div className="flex justify-between px-5 py-3.5 text-sm">
                <span className="text-muted-foreground">Period</span>
                <span className="text-foreground tabular-nums">
                  {formatDate(usage.period_start)} → {formatDate(usage.period_end)}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Top Up Modal */}
      <AnimatePresence>
        {showTopup && (
          <motion.div
            key="topup-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => topupStatus !== "submitting" && setShowTopup(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Top Up Hours</h2>
                <button
                  onClick={() => setShowTopup(false)}
                  disabled={topupStatus === "submitting"}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {TOPUP_OPTIONS.map(([hrs]) => (
                  <button
                    key={hrs}
                    onClick={() => setSelectedHours(hrs)}
                    className={`rounded-lg border px-3 py-2.5 text-center transition-all ${
                      selectedHours === hrs
                        ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <span className={`text-sm font-semibold tabular-nums ${selectedHours === hrs ? "text-primary" : "text-foreground"}`}>
                      {hrs}h
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="mb-4">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Custom hours</label>
                <input
                  type="number"
                  min={2}
                  step={1}
                  value={selectedHours}
                  onChange={(e) => setSelectedHours(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                />
              </div>

              {/* Cost estimate */}
              <div className="mb-5 rounded-lg bg-muted/40 px-3.5 py-2.5 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {selectedHours < 2 ? (
                  <p className="text-xs text-red-400">Minimum is 2 hours</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <span className="text-foreground font-medium tabular-nums">{selectedHours}h</span>
                    <span className="mx-1.5 text-muted-foreground/40">&times;</span>
                    <span className="text-foreground font-medium">₹{overageRate}</span>
                    <span className="mx-1.5 text-muted-foreground/40">=</span>
                    <span className="text-foreground font-semibold tabular-nums">₹{(selectedHours * overageRate).toLocaleString("en-IN")}</span>
                  </p>
                )}
              </div>

              {/* Status messages */}
              <AnimatePresence mode="wait">
                {topupStatus === "success" && (
                  <motion.p key="success" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-primary font-medium mb-4">
                    Request submitted! An admin will process it shortly.
                  </motion.p>
                )}
                {topupStatus === "error" && (
                  <motion.p key="error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-red-400 mb-4">
                    Failed to submit request. Please try again.
                  </motion.p>
                )}
              </AnimatePresence>

              <Button
                onClick={handleTopup}
                disabled={topupStatus === "submitting" || selectedHours < 2}
                className="w-full"
                size="lg"
              >
                {topupStatus === "submitting" ? "Submitting\u2026" : `Top Up ${selectedHours}h`}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgrade && (
          <motion.div
            key="upgrade-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowUpgrade(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">Upgrade to full plan</h2>
                </div>
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                To activate your full plan, reach out to our team. We&apos;ll set up your subscription,
                send an invoice, and activate your account as soon as payment is received.
              </p>

              {/* How it works */}
              <div className="rounded-lg border border-border bg-card/30 p-4 mb-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6875rem] font-semibold text-primary tabular-nums">1</div>
                  <p className="text-sm text-foreground leading-relaxed">Contact us to discuss devices + commitment tier (monthly / quarterly / annual).</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6875rem] font-semibold text-primary tabular-nums">2</div>
                  <p className="text-sm text-foreground leading-relaxed">We&apos;ll send a detailed invoice for the agreed plan.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6875rem] font-semibold text-primary tabular-nums">3</div>
                  <p className="text-sm text-foreground leading-relaxed">Once payment lands, we activate your account — full analysis hours unlocked immediately.</p>
                </div>
              </div>

              {/* Contact */}
              <a
                href={`mailto:${UPGRADE_CONTACT_EMAIL}?subject=Upgrade%20to%20full%20plan`}
                className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Email us</p>
                    <p className="text-sm font-medium text-foreground truncate">{UPGRADE_CONTACT_EMAIL}</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-primary shrink-0" />
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction history */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15, ease: [0.33, 1, 0.68, 1] }}
      >
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Activity
          {transactions.length > 0 && (
            <span className="ml-2 text-muted-foreground/40">{transactions.length}</span>
          )}
        </h2>
        {transactions.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30 text-muted-foreground">
            <RefreshCw className="h-5 w-5 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/80">No activity yet</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Top-ups and analysis usage will appear here</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/30 divide-y divide-border/50 overflow-hidden">
            {transactions.map((txn) => (
              <TransactionItem key={txn.id} txn={txn} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
