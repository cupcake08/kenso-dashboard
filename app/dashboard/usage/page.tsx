"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { CreditBalance, Transaction } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
    <tr className="border-slate-800 text-sm">
      <td className="py-3 px-4 text-slate-400">
        {new Date(txn.created_at).toLocaleDateString()}
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          txn.type === "topup" ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800"
          : txn.type === "analysis" ? "bg-blue-950/50 text-blue-400 border border-blue-800"
          : "bg-amber-950/50 text-amber-400 border border-amber-800"
        }`}>
          {txn.type}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className={isPositive ? "text-emerald-400" : "text-red-400"}>
          {isPositive ? "+" : ""}{txn.amount.toLocaleString()}
        </span>
      </td>
      <td className="py-3 px-4 text-slate-400">
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
    apiFetch<{ balance: CreditBalance; transactions: Transaction[] }>("/credits")
      .then(({ balance, transactions }) => {
        setBalance(balance);
        setTransactions(transactions);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
    </div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-900 bg-red-950/30 p-6 text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Usage</h1>
        <p className="mt-1 text-sm text-slate-400">Credits and billing for your organization</p>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
      >
        <Card className="border-emerald-900/50 bg-gradient-to-br from-slate-900 to-slate-900/80">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Credits Balance</p>
                <motion.p
                  className="mt-2 text-5xl font-bold tabular-nums text-emerald-400"
                >
                  {count.toLocaleString()}
                </motion.p>
                <p className="mt-2 text-xs text-slate-600">
                  Last updated: {balance?.last_updated ? new Date(balance.last_updated).toLocaleString() : "—"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <Button
                  onClick={() => {/* TODO: topup modal */}}
                  className="bg-emerald-600 hover:bg-emerald-500"
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
        <h2 className="mb-4 text-lg font-semibold text-slate-50">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 text-slate-500">
            <RefreshCw className="h-6 w-6" />
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
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
