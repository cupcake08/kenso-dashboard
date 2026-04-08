"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, RefreshCw } from "lucide-react";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { CreditBalance, Transaction } from "@/types/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionBadge } from "@/components/ui/badge-type";
import { Skeleton, TransactionSkeleton } from "@/components/ui/skeleton";

const DEMO_BALANCE: CreditBalance = { balance: 24850, last_updated: new Date().toISOString() };
const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "txn_001", type: "topup", amount: 10000, balance_after: 24850, description: "Credit top-up", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "txn_002", type: "analysis", amount: -350, balance_after: 14850, description: "Audio analysis — 35 windows", created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "txn_003", type: "analysis", amount: -700, balance_after: 15200, description: "Audio analysis — 70 windows", created_at: new Date(Date.now() - 259200000).toISOString() },
];

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease out cubic
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
        {txn.balance_after.toLocaleString()}
      </td>
    </tr>
  );
}

export default function UsagePage() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const count = useCountUp(balance?.balance ?? 0);

  useEffect(() => {
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
    apiFetch<{ balance: CreditBalance; transactions: Transaction[] }>("/credits")
      .then(({ balance, transactions }) => {
        setBalance(balance);
        setTransactions(transactions);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
                <th className="py-3 px-4 font-medium">Balance</th>
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
                <motion.p
                  className="mt-1 text-4xl font-bold tabular-nums text-foreground"
                >
                  {count.toLocaleString()}
                </motion.p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last updated: {balance?.last_updated ? new Date(balance.last_updated).toLocaleString() : "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => {/* TODO: topup modal */}}
                  className="bg-primary hover:bg-primary/90"
                >
                  <TrendingUp className="h-4 w-4" />
                  Top Up
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

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
                  <th className="py-3 px-4 font-medium">Balance</th>
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
