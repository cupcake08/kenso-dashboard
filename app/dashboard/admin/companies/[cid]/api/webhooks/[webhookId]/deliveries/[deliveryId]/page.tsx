"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Loader2, ArrowLeft, RefreshCw, ChevronDown, ChevronRight,
  Copy, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminFetch, setAdminKey, hasAdminKey,
  getDelivery, retryDelivery,
} from "@/lib/admin-api";
import { toast } from "sonner";

/* ── Helpers ── */

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function statusColor(status: string): string {
  switch (status) {
    case "delivered": return "bg-status-online/10 text-status-online";
    case "pending": return "bg-amber-500/10 text-amber-500";
    case "in_flight": return "bg-blue-500/10 text-blue-500";
    case "retrying": return "bg-amber-500/10 text-amber-500";
    case "failed_permanently": return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/* ── Admin Key Gate ── */

function AdminKeyGate({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const test = async () => {
    setTesting(true);
    setError("");
    setAdminKey(key);
    try {
      await adminFetch("/v2/admin/billing/companies");
      onUnlock();
    } catch {
      setError("Invalid key or server unreachable");
      setAdminKey("");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <Shield className="h-10 w-10 text-muted-foreground/30" />
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">Admin Access</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your admin API key to continue</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && key && test()}
          placeholder="Admin API Key"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p className="text-xs text-status-offline">{error}</p>}
        <Button onClick={test} disabled={!key || testing} className="w-full">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
        </Button>
      </div>
    </div>
  );
}

/* ── Collapsible JSON Section ── */

function JsonSection({ title, data }: { title: string; data: unknown }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const text = formatJson(data);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-card/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
        >
          {copied ? <CheckCircle2 className="h-3 w-3 text-status-online" /> : <Copy className="h-3 w-3" />}
        </Button>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-auto max-h-96 text-foreground/80">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cid = params.cid as string;
  const webhookId = params.webhookId as string;
  const deliveryId = params.deliveryId as string;

  const [authed, setAuthed] = useState(false);
  const [delivery, setDelivery] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRetry, setShowRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const loadDelivery = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDelivery(deliveryId);
      setDelivery(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load delivery");
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    if (hasAdminKey()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed) loadDelivery();
  }, [authed, loadDelivery]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryDelivery(deliveryId);
      toast.success("Delivery requeued for retry");
      setShowRetry(false);
      await loadDelivery();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry delivery");
    } finally {
      setRetrying(false);
    }
  };

  if (!authed) {
    return <AdminKeyGate onUnlock={() => setAuthed(true)} />;
  }

  const status = (delivery?.status as string) || "";
  const eventType = (delivery?.event_type as string) || "";
  const attempts = (delivery?.attempts as number) ?? 0;
  const lastError = (delivery?.last_error as string) || "";
  const createdAt = (delivery?.created_at_unix as number) ?? 0;
  const nextAttempt = (delivery?.next_attempt_at_unix as number) ?? 0;
  const lastResponseStatus = delivery?.last_response_status as number | undefined;
  const payload = delivery?.payload;
  const responseBody = delivery?.response_body;
  const isFailedPermanently = status === "failed_permanently";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push(`/dashboard/admin/companies/${cid}/api/webhooks/${webhookId}`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Webhook
      </button>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : !delivery ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30">
          <p className="text-sm text-muted-foreground">Delivery not found</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card/50 p-5"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-semibold text-foreground">Delivery Detail</h1>
                    <span className={`text-[0.6875rem] px-2 py-0.5 rounded-full ${statusColor(status)}`}>
                      {status}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{deliveryId}</p>
                </div>
                {isFailedPermanently && (
                  <Button variant="outline" size="sm" onClick={() => setShowRetry(true)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Retry
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div>
                  <p className="text-[0.6875rem] text-muted-foreground/50">Event Type</p>
                  <p className="text-sm font-mono text-foreground">{eventType}</p>
                </div>
                <div>
                  <p className="text-[0.6875rem] text-muted-foreground/50">Attempts</p>
                  <p className="text-sm text-foreground">{attempts}</p>
                </div>
                <div>
                  <p className="text-[0.6875rem] text-muted-foreground/50">Created</p>
                  <p className="text-sm text-foreground">{createdAt ? formatDate(createdAt) : "\u2014"}</p>
                </div>
                <div>
                  <p className="text-[0.6875rem] text-muted-foreground/50">Next Attempt</p>
                  <p className="text-sm text-foreground">{nextAttempt ? formatDate(nextAttempt) : "\u2014"}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Response info */}
          {(lastResponseStatus !== undefined || lastError) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl border border-border bg-card/50 p-5 space-y-2"
            >
              <h2 className="text-sm font-semibold text-foreground">Response Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lastResponseStatus !== undefined && (
                  <div>
                    <p className="text-[0.6875rem] text-muted-foreground/50">HTTP Status</p>
                    <p className={`text-sm font-mono ${
                      lastResponseStatus >= 200 && lastResponseStatus < 300 ? "text-status-online" :
                      lastResponseStatus >= 400 ? "text-destructive" : "text-foreground"
                    }`}>
                      {lastResponseStatus}
                    </p>
                  </div>
                )}
                {lastError && (
                  <div className="md:col-span-2">
                    <p className="text-[0.6875rem] text-muted-foreground/50">Last Error</p>
                    <p className="text-sm text-destructive">{lastError}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Payload viewer */}
          {payload !== undefined && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <JsonSection title="Payload" data={payload} />
            </motion.div>
          )}

          {/* Response body */}
          {responseBody !== undefined && responseBody !== null && String(responseBody) !== "" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <JsonSection title="Response Body" data={responseBody} />
            </motion.div>
          )}
        </>
      )}

      {/* Retry confirmation */}
      <AnimatePresence>
        {showRetry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-background rounded-2xl border border-border p-6 max-w-md mx-4 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                  <RefreshCw className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Retry Delivery</h3>
                  <p className="text-xs text-muted-foreground font-mono">{deliveryId}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                This will requeue the delivery for another attempt. The webhook endpoint will receive the event again.
              </p>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowRetry(false)} disabled={retrying}>Cancel</Button>
                <Button className="flex-1" onClick={handleRetry} disabled={retrying}>
                  {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retry"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
