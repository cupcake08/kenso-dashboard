"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Coins, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/admin-api";

interface PendingTopup {
  id: string;
  company_id: string;
  company_name: string;
  amount: number;
  created_at_unix: number;
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminTopupsPage() {
  const [apiKey, setApiKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [topups, setTopups] = useState<PendingTopup[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("admin-api-key");
    if (saved) {
      setApiKey(saved);
      setAuthenticated(true);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<PendingTopup[]>("/v2/admin/topups/pending");
      setTopups(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
      if (err instanceof Error && err.message.includes("401")) {
        setAuthenticated(false);
        localStorage.removeItem("admin-api-key");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) fetchPending();
  }, [authenticated, fetchPending]);

  function handleLogin() {
    if (!apiKey.trim()) return;
    localStorage.setItem("admin-api-key", apiKey.trim());
    setAuthenticated(true);
  }

  async function handleApprove(topup: PendingTopup) {
    setProcessing(topup.id);
    try {
      const res = await adminFetch<{ new_balance: number }>(
        `/v2/admin/topups/${topup.company_id}/${topup.id}/approve`,
        { method: "POST" }
      );
      toast.success(`Approved ${topup.amount.toLocaleString("en-IN")} credits for ${topup.company_name}. New balance: ${res.new_balance.toLocaleString("en-IN")}`);
      setTopups((prev) => prev.filter((t) => t.id !== topup.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(topup: PendingTopup) {
    const ok = window.confirm(
      `Reject this ${topup.amount.toLocaleString("en-IN")}-credit top-up from ${topup.company_name}?`
    );
    if (!ok) return;
    setProcessing(topup.id);
    try {
      await adminFetch(
        `/v2/admin/topups/${topup.company_id}/${topup.id}/reject`,
        { method: "POST", body: JSON.stringify({ reason: "" }) }
      );
      toast.success(`Rejected top-up for ${topup.company_name}`);
      setTopups((prev) => prev.filter((t) => t.id !== topup.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setProcessing(null);
    }
  }

  // Auth gate
  if (!authenticated) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">Admin Access</h1>
        <p className="text-sm text-muted-foreground mb-6">Enter the admin API key to manage top-up requests</p>
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Admin API key"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={!apiKey.trim()}>
            Sign In
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Top-Up Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review and approve credit top-up requests from tenants</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPending} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {/* List */}
      {loading && topups.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : topups.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/80">All caught up</p>
            <p className="text-xs text-muted-foreground/50 mt-1">No pending top-up requests</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {topups.map((topup) => (
              <motion.div
                key={topup.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-border bg-card/50 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold tabular-nums text-foreground">
                          {topup.amount.toLocaleString("en-IN")} credits
                        </p>
                        <span className="text-xs text-muted-foreground/50">
                          ~{Math.round(topup.amount / 100 * 10) / 10}h
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{topup.company_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground/50 mt-1 tabular-nums">
                        Requested {formatDate(topup.created_at_unix)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(topup)}
                      disabled={processing === topup.id}
                      className="text-red-400 border-red-400/20 hover:bg-red-400/10 hover:text-red-300"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(topup)}
                      disabled={processing === topup.id}
                    >
                      {processing === topup.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      }
                      Approve
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
