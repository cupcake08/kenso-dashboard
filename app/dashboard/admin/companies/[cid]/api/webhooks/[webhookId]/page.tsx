"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Loader2, Webhook, Copy, CheckCircle2, XCircle,
  AlertTriangle, ArrowLeft, RefreshCw, Send, Trash2,
  ExternalLink, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminFetch, setAdminKey, hasAdminKey,
  listWebhooks, updateWebhook, deleteWebhook,
  rotateWebhookSecret, sendTestEvent, listDeliveries, retryDelivery,
} from "@/lib/admin-api";
import type { WebhookItem, CreateWebhookResponse, DeliveryItem } from "@/lib/admin-api";
import { toast } from "sonner";

/* ── Helpers ── */

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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

/* ── Reveal Secret Modal ── */

function RevealSecretModal({
  secret,
  title,
  onDone,
}: {
  secret: string;
  title: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-background rounded-2xl border border-border p-6 max-w-lg mx-4 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Webhook className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">Copy this secret now. It will not be shown again.</p>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-lg border border-border bg-card/50 p-3 pr-12">
            <code className="text-sm font-mono text-foreground break-all select-all">{secret}</code>
          </div>
          <Button variant="ghost" size="icon" className="absolute right-1.5 top-1.5 h-8 w-8" onClick={handleCopy}>
            {copied ? <CheckCircle2 className="h-4 w-4 text-status-online" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
          </Button>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            I have saved this secret in a secure location
          </span>
        </label>

        <Button className="w-full" onClick={onDone} disabled={!confirmed}>Done</Button>
      </motion.div>
    </motion.div>
  );
}

/* ── Delete Webhook Modal ── */

function DeleteWebhookModal({
  url,
  onConfirm,
  onCancel,
  loading,
}: {
  url: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");

  return (
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Delete Webhook</h3>
            <p className="text-sm text-muted-foreground font-mono">{url}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          This will permanently delete this webhook and stop all event deliveries.
        </p>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Type <span className="font-mono text-foreground">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={confirmText !== "DELETE" || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Webhook"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Page ── */

export default function WebhookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cid = params.cid as string;
  const webhookId = params.webhookId as string;

  const [authed, setAuthed] = useState(false);
  const [webhook, setWebhook] = useState<WebhookItem | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editEnabled, setEditEnabled] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Modals
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateResult, setRotateResult] = useState<CreateWebhookResponse | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testCooldown, setTestCooldown] = useState(false);
  const [retryTarget, setRetryTarget] = useState<DeliveryItem | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wh, dels] = await Promise.all([
        listWebhooks(cid),
        listDeliveries(cid, webhookId),
      ]);
      const found = (wh ?? []).find((w) => w.webhook_id === webhookId) || null;
      setWebhook(found);
      if (found) {
        setEditUrl(found.url);
        setEditLabel(found.label);
        setEditEnabled(found.enabled);
      }
      setDeliveries(dels ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load webhook");
    } finally {
      setLoading(false);
    }
  }, [cid, webhookId]);

  useEffect(() => {
    if (hasAdminKey()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed, loadData]);

  useEffect(() => {
    if (!webhook) return;
    setDirty(editUrl !== webhook.url || editLabel !== webhook.label || editEnabled !== webhook.enabled);
  }, [editUrl, editLabel, editEnabled, webhook]);

  const handleSave = async () => {
    if (!webhook) return;
    setSaving(true);
    try {
      await updateWebhook(cid, webhookId, {
        url: editUrl,
        label: editLabel,
        enabled: editEnabled,
      });
      toast.success("Webhook updated");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const res = await rotateWebhookSecret(cid, webhookId);
      setShowRotateConfirm(false);
      setRotateResult(res);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rotate secret");
    } finally {
      setRotating(false);
    }
  };

  const handleTest = async () => {
    try {
      await sendTestEvent(cid, webhookId);
      toast.success("Test event enqueued");
      setTestCooldown(true);
      setTimeout(() => setTestCooldown(false), 10000);
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test event");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteWebhook(cid, webhookId);
      toast.success("Webhook deleted");
      router.push(`/dashboard/admin/companies/${cid}/api/webhooks`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete webhook");
    } finally {
      setDeleting(false);
    }
  };

  const handleRetry = async () => {
    if (!retryTarget) return;
    setRetrying(true);
    try {
      await retryDelivery(retryTarget.delivery_id);
      toast.success("Delivery requeued for retry");
      setRetryTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry delivery");
    } finally {
      setRetrying(false);
    }
  };

  if (!authed) {
    return <AdminKeyGate onUnlock={() => setAuthed(true)} />;
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push(`/dashboard/admin/companies/${cid}/api/webhooks`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Webhooks
      </button>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : !webhook ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30">
          <Webhook className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Webhook not found</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card/50 p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-foreground">Webhook Detail</h1>
                  <span className="text-xs font-mono text-muted-foreground">{webhookId}</span>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{webhook.url}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {webhook.enabled ? (
                    <span className="inline-flex items-center gap-1 text-[0.6875rem] px-2 py-0.5 rounded-full bg-status-online/10 text-status-online">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[0.6875rem] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      <XCircle className="h-3 w-3" /> Disabled
                    </span>
                  )}
                  {webhook.consecutive_failures > 0 && (
                    <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                      {webhook.consecutive_failures} consecutive failures
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Edit form */}
            <div className="space-y-3 pt-3 border-t border-border/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
                  <input
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Label</label>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEnabled}
                    onChange={(e) => setEditEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-muted-foreground">Enabled</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex items-center gap-2 flex-wrap"
          >
            <Button variant="outline" size="sm" onClick={() => setShowRotateConfirm(true)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Rotate Secret
            </Button>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testCooldown}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {testCooldown ? "Test Sent" : "Send Test Event"}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Webhook
            </Button>
          </motion.div>

          {/* Delivery log */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-foreground">Delivery Log</h2>
              <span className="text-xs text-muted-foreground">{deliveries.length} deliveries</span>
            </div>

            {deliveries.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card/30">
                <p className="text-sm text-muted-foreground/50">No deliveries yet</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card/30">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Event</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Attempts</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">HTTP Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Created</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((del) => (
                      <tr key={del.delivery_id} className="border-b border-border/30 hover:bg-card/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/admin/companies/${cid}/api/webhooks/${webhookId}/deliveries/${del.delivery_id}`}
                            className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                          >
                            <span className="font-mono text-xs">{del.event_type}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[0.6875rem] px-2 py-0.5 rounded-full ${statusColor(del.status)}`}>
                            {del.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{del.attempts}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                          {del.last_response_status ?? "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(del.created_at_unix)}</td>
                        <td className="px-4 py-3 text-right">
                          {del.status === "failed_permanently" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[0.6875rem] text-amber-500 hover:text-amber-400"
                              onClick={() => setRetryTarget(del)}
                            >
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Rotate secret confirmation */}
      <AnimatePresence>
        {showRotateConfirm && !rotateResult && (
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
                  <h3 className="text-base font-semibold text-foreground">Rotate Signing Secret</h3>
                  <p className="text-sm text-muted-foreground">The old secret will stop working immediately.</p>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowRotateConfirm(false)} disabled={rotating}>Cancel</Button>
                <Button className="flex-1" onClick={handleRotate} disabled={rotating}>
                  {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rotate Secret"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reveal rotated secret */}
      <AnimatePresence>
        {rotateResult && (
          <RevealSecretModal
            secret={rotateResult.signing_secret}
            title="New Signing Secret"
            onDone={() => setRotateResult(null)}
          />
        )}
      </AnimatePresence>

      {/* Delete webhook modal */}
      <AnimatePresence>
        {showDelete && (
          <DeleteWebhookModal
            url={webhook?.url || ""}
            onConfirm={handleDelete}
            onCancel={() => setShowDelete(false)}
            loading={deleting}
          />
        )}
      </AnimatePresence>

      {/* Retry delivery confirmation */}
      <AnimatePresence>
        {retryTarget && (
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
                  <p className="text-xs text-muted-foreground font-mono">{retryTarget.delivery_id}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                This will requeue the delivery for another attempt. The webhook endpoint will receive the event again.
              </p>
              {retryTarget.last_error && (
                <p className="text-xs text-muted-foreground/60">Last error: {retryTarget.last_error}</p>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setRetryTarget(null)} disabled={retrying}>Cancel</Button>
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
