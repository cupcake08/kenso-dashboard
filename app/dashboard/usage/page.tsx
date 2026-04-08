"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, RefreshCw, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { apiFetch, normalizeCredits } from "@/lib/api";
import type { Transaction, RawCreditsResponse } from "@/types/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionBadge } from "@/components/ui/badge-type";
import { Skeleton, TransactionSkeleton } from "@/components/ui/skeleton";

const DEMO_BALANCE = 24850;
const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "txn_001", type: "topup", amount: 10000, description: "Credit top-up", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "txn_002", type: "analysis", amount: -350, description: "Audio analysis — 35 windows", created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "txn_003", type: "analysis", amount: -700, description: "Audio analysis — 70 windows", created_at: new Date(Date.now() - 259200000).toISOString() },
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

function TransactionRow({ txn }: { txn: Transaction }) {
  const isPositive = txn.amount > 0;
  return (
    <tr className="border-border text-sm">
      <td className="py-3 px-4 text-muted-foreground">
        {new Date(txn.created_at).toLocaleDateString()}
      </td>
      <td className="py-3 px-4">
        <TransactionBadge type={txn.type} />
      </td>
      <td className="py-3 px-4">
        <span className={isPositive ? "text-primary" : "text-red-400"}>
          {isPositive ? "+" : ""}{txn.amount.toLocaleString()}
        </span>
      </td>
      <td className="py-3 px-4 text-muted-foreground">
        {txn.description || "—"}
      </td>
    </tr>
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

  const fetchCredits = useCallback(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      setBalance(DEMO_BALANCE);
      setTransactions(DEMO_TRANSACTIONS);
      setLoading(false);
      return;
    }
    if (!auth?.currentUser) {
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
    fetchCredits();
  }, [fetchCredits]);

  async function handleTopup() {
    setTopupStatus("submitting");
    try {
      if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
        // Simulate topup in demo mode
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
        // Refresh credits after topup
        await fetchCredits();
      }
      setTopupStatus("success");
      setTimeout(() => {
        setTopupStatus("idle");
        setShowTopup(false);
      }, 1500);
    } catch {
      setTopupStatus("error");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
        </div>
        <Card className="border-border bg-card/50">
          <CardContent className="p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-1 h-10 w-36" />
            <Skeleton className="mt-2 h-3 w-44" />
          </CardContent>
        </Card>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => <TransactionSkeleton key={i} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-900 bg-red-950/30 p-6 text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">Credits and billing for your organization</p>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
      >
        <Card className="border-border bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Credits Balance</p>
                <motion.p className="mt-1 text-4xl font-bold tabular-nums text-foreground">
                  {count.toLocaleString()}
                </motion.p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {transactions.length > 0
                    ? `Last activity: ${new Date(transactions[0].created_at).toLocaleString()}`
                    : "No activity yet"}
                </p>
              </div>
              <Button
                onClick={() => setShowTopup(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <TrendingUp className="h-4 w-4 mr-1.5" />
                Top Up
              </Button>
            </div>
          </CardContent>
        </Card>
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
              className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-foreground">Top Up Credits</h2>
                <button
                  onClick={() => setShowTopup(false)}
                  disabled={topupStatus === "submitting"}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Quick amount buttons */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {TOPUP_OPTIONS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      topupAmount === amt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {amt.toLocaleString()} credits
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="mb-5">
                <label className="text-xs text-muted-foreground mb-1.5 block">Or enter custom amount</label>
                <input
                  type="number"
                  min={100}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Math.max(100, parseInt(e.target.value) || 100))}
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {topupAmount < 100 && (
                  <p className="mt-1 text-xs text-red-400">Minimum top-up is 100 credits</p>
                )}
              </div>

              {/* Status messages */}
              {topupStatus === "success" ? (
                <p className="text-sm text-primary font-medium mb-4">Request submitted! An admin will process it shortly.</p>
              ) : topupStatus === "error" ? (
                <p className="text-sm text-red-400 mb-4">Failed to submit request. Please try again.</p>
              ) : null}

              <Button
                onClick={handleTopup}
                disabled={topupStatus === "submitting" || topupAmount < 100}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {topupStatus === "submitting" ? "Submitting…" : `Top Up ${topupAmount.toLocaleString()} Credits`}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction history */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-border text-muted-foreground">
            <RefreshCw className="h-6 w-6" />
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Amount</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
