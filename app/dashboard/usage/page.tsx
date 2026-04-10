"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, RefreshCw, X, Clock, Coins, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { apiFetch, normalizeCredits } from "@/lib/api";
import type { Transaction, RawCreditsResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Skeleton, TransactionSkeleton } from "@/components/ui/skeleton";

const DEMO_BALANCE = 24850;
const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "txn_001", type: "topup", amount: 10000, description: "Credit top-up", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "txn_002", type: "analysis", amount: -350, description: "Audio analysis \u2014 35 windows", created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "txn_003", type: "analysis", amount: -700, description: "Audio analysis \u2014 70 windows", created_at: new Date(Date.now() - 259200000).toISOString() },
];

const TOPUP_OPTIONS = [500, 1000, 2500, 5000];

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
}

function TransactionItem({ txn }: { txn: Transaction }) {
  const isPositive = txn.amount > 0;
  const isPending = txn.description?.includes("pending");

  return (
    <div className="flex items-center gap-4 px-4 py-4 sm:px-5 hover:bg-muted/10 transition-colors">
      {/* Icon */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        isPositive ? "bg-emerald-500/10" : "bg-blue-500/10"
      }`}>
        {isPositive
          ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          : <ArrowDownRight className="h-4 w-4 text-blue-400" />
        }
      </div>

      {/* Description + metadata */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {txn.type === "topup" ? "Credit Top Up" : txn.type === "analysis" ? "Audio Analysis" : txn.type}
          </p>
          {isPending && (
            <span className="inline-flex items-center text-[0.6875rem] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0">
              Pending
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {txn.description && !isPending
            ? txn.description
            : isPending
              ? "Awaiting admin confirmation"
              : "\u2014"
          }
        </p>
      </div>

      {/* Amount + date */}
      <div className="text-right shrink-0">
        <p className={`text-base font-semibold tabular-nums leading-tight ${
          isPositive ? "text-emerald-400" : "text-foreground"
        }`}>
          {isPositive ? "+" : ""}{txn.amount.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">
          {formatDate(txn.created_at)}
        </p>
      </div>
    </div>
  );
}

export default function UsagePage() {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState(1000);
  const [topupStatus, setTopupStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const count = useCountUp(balance);
  const hoursEquiv = Math.round(balance / 100 * 10) / 10;

  const fetchCredits = useCallback(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      setBalance(DEMO_BALANCE);
      setTransactions(DEMO_TRANSACTIONS);
      setLoading(false);
      return;
    }
    apiFetch<RawCreditsResponse>("/credits")
      .then(normalizeCredits)
      .then(({ balance, transactions }) => {
        setBalance(balance);
        setTransactions(transactions);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      fetchCredits();
      return;
    }
    let unsub: (() => void) | undefined;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      if (!auth) { setLoading(false); return; }
      unsub = onAuthStateChanged(auth, (user) => {
        if (!user) { setLoading(false); return; }
        fetchCredits();
      });
    });
    return () => unsub?.();
  }, [fetchCredits]);

  async function handleTopup() {
    setTopupStatus("submitting");
    try {
      if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
        await new Promise((r) => setTimeout(r, 800));
        setBalance((b) => b + topupAmount);
        setTransactions((prev) => [
          { id: `txn_demo_${Date.now()}`, type: "topup" as const, amount: topupAmount, description: "Credit top-up (demo)", created_at: new Date().toISOString() },
          ...prev,
        ]);
      } else {
        await apiFetch("/credits/topup", {
          method: "POST",
          body: JSON.stringify({ amount: topupAmount }),
        });
        await fetchCredits();
      }
      setTopupStatus("success");
      toast.success(`${topupAmount.toLocaleString()} credits added`);
      setTimeout(() => {
        setTopupStatus("idle");
        setShowTopup(false);
      }, 1500);
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
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Usage</h1>
        <p className="text-sm text-muted-foreground mb-6">Credits and billing for your organization</p>
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-red-400">Unable to load usage data</p>
          <Button variant="ghost" size="sm" onClick={() => { setError(""); fetchCredits(); }} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">Credits and billing for your organization</p>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.33, 1, 0.68, 1] }}
      >
        <div className="rounded-xl border border-border bg-card/60 p-6 sm:p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Credits Balance</p>
              </div>
              <p className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight text-foreground leading-none">
                {count.toLocaleString()}
              </p>
              <div className="mt-3 flex items-center gap-4">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  ~{hoursEquiv}h of analysis remaining
                </p>
              </div>
              {transactions.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground/60">
                  Last activity {formatDate(transactions[0].created_at)}
                </p>
              )}
            </div>
            <Button
              onClick={() => setShowTopup(true)}
              size="lg"
              className="bg-primary hover:bg-primary/90 shrink-0"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Top Up
            </Button>
          </div>
        </div>
      </motion.div>

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
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Top Up Credits</h2>
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
                {TOPUP_OPTIONS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    className={`rounded-lg border px-3 py-2.5 text-center transition-all ${
                      topupAmount === amt
                        ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <span className={`text-sm font-semibold tabular-nums ${topupAmount === amt ? "text-primary" : "text-foreground"}`}>
                      {amt >= 1000 ? `${amt / 1000}k` : amt}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="mb-4">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Custom amount</label>
                <input
                  type="number"
                  min={100}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Math.max(100, parseInt(e.target.value) || 100))}
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                />
              </div>

              {/* Single estimate line */}
              <div className="mb-5 rounded-lg bg-muted/40 px-3.5 py-2.5 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {topupAmount < 100 ? (
                  <p className="text-xs text-red-400">Minimum is 100 credits</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <span className="text-foreground font-medium tabular-nums">{topupAmount.toLocaleString()}</span> credits
                    <span className="mx-1.5 text-muted-foreground/40">=</span>
                    <span className="text-foreground font-medium tabular-nums">~{Math.round(topupAmount / 100 * 10) / 10}h</span> of analysis
                  </p>
                )}
              </div>

              {/* Status */}
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
                disabled={topupStatus === "submitting" || topupAmount < 100}
                className="w-full"
                size="lg"
              >
                {topupStatus === "submitting" ? "Submitting\u2026" : `Top Up ${topupAmount.toLocaleString()} Credits`}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction history */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.33, 1, 0.68, 1] }}
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
