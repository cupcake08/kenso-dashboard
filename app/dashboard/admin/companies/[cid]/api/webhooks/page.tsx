"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Loader2, Webhook, Plus, Copy, CheckCircle2, XCircle,
  AlertTriangle, ArrowLeft, RefreshCw, Send, Trash2, Power, PowerOff,
  ExternalLink, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminFetch, setAdminKey, hasAdminKey,
  listWebhooks, createWebhook, updateWebhook, deleteWebhook,
  rotateWebhookSecret, sendTestEvent,
  webhookEventOptions, defaultWebhookEventTypes,
} from "@/lib/admin-api";
import type { WebhookEventType, WebhookItem, CreateWebhookResponse } from "@/lib/admin-api";
import { toast } from "sonner";

/* ── Helpers ── */

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function truncateUrl(url: string, max = 50): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "...";
}

function toggleWebhookEventType(selected: WebhookEventType[], eventType: WebhookEventType): WebhookEventType[] {
  return selected.includes(eventType)
    ? selected.filter((item) => item !== eventType)
    : [...selected, eventType];
}

function effectiveWebhookEventTypes(eventTypes?: WebhookEventType[]): WebhookEventType[] {
  return eventTypes && eventTypes.length > 0 ? eventTypes : defaultWebhookEventTypes;
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

/* ── Tab Nav ── */

function TabNav({ cid, active }: { cid: string; active: "overview" | "keys" | "webhooks" | "audit" }) {
  const tabs = [
    { id: "overview" as const, label: "Overview", href: `/dashboard/admin/companies/${cid}/api` },
    { id: "keys" as const, label: "API Keys", href: `/dashboard/admin/companies/${cid}/api/keys` },
    { id: "webhooks" as const, label: "Webhooks", href: `/dashboard/admin/companies/${cid}/api/webhooks` },
    { id: "audit" as const, label: "Audit Log", href: `/dashboard/admin/companies/${cid}/api/audit` },
  ];
  return (
    <div className="flex gap-1 border-b border-border/50">
      {tabs.map((tab) => (
        <Link key={tab.id} href={tab.href}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            active === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}>
          {tab.label}
          {active === tab.id && (
            <motion.div layoutId="api-tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
              transition={{ duration: 0.2 }} />
          )}
        </Link>
      ))}
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
            <code className="text-sm font-mono text-foreground break-all select-all">
              {secret}
            </code>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 h-8 w-8"
            onClick={handleCopy}
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-status-online" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            I have saved this secret in a secure location
          </span>
        </label>

        <Button className="w-full" onClick={onDone} disabled={!confirmed}>
          Done
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ── Create Webhook Modal ── */

function CreateWebhookModal({
  onCreate,
  onCancel,
  loading,
}: {
  onCreate: (url: string, label: string, eventTypes: WebhookEventType[]) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [eventTypes, setEventTypes] = useState<WebhookEventType[]>(defaultWebhookEventTypes);
  const [error, setError] = useState("");

  const isHttps = url.startsWith("https://");
  const isHttp = url.startsWith("http://") && !isHttps;
  const validUrl = url.startsWith("http://") || url.startsWith("https://");

  const handleSubmit = () => {
    if (!url.trim()) return;
    if (!validUrl) {
      setError("URL must start with http:// or https://");
      return;
    }
    if (eventTypes.length === 0) {
      setError("Select at least one event type");
      return;
    }
    setError("");
    onCreate(url.trim(), label.trim(), eventTypes);
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
        className="bg-background rounded-2xl border border-border p-6 max-w-md mx-4 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Add Webhook</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Endpoint URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              placeholder="https://example.com/webhooks/kenso"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && url.trim() && handleSubmit()}
            />
            {isHttp && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                HTTPS is recommended for security
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Production handler"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => e.key === "Enter" && url.trim() && handleSubmit()}
            />
          </div>
          <div className="rounded-xl border border-border/70 bg-card/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">Event subscriptions</label>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setEventTypes(["mic.offline", "mic.online"])}>
                MIC health only
              </Button>
            </div>
            <div className="mt-2 grid gap-2">
              {webhookEventOptions.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={eventTypes.includes(option.value)}
                    onChange={() => setEventTypes((current) => toggleWebhookEventType(current, option.value))}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <span>
                    <span className="block text-xs font-medium text-foreground">{option.label}</span>
                    <span className="block text-[0.68rem] leading-4 text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!url.trim() || eventTypes.length === 0 || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Webhook"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Delete Webhook Modal ── */

function DeleteWebhookModal({
  webhook,
  onConfirm,
  onCancel,
  loading,
}: {
  webhook: WebhookItem;
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
            <p className="text-sm text-muted-foreground font-mono">{truncateUrl(webhook.url, 40)}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          This will permanently delete this webhook and stop all event deliveries to this endpoint.
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
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={confirmText !== "DELETE" || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Webhook"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Webhook Card ── */

function WebhookCard({
  webhook,
  cid,
  onToggle,
  onRotate,
  onTest,
  onDelete,
  testCooldown,
}: {
  webhook: WebhookItem;
  cid: string;
  onToggle: (wh: WebhookItem) => void;
  onRotate: (wh: WebhookItem) => void;
  onTest: (wh: WebhookItem) => void;
  onDelete: (wh: WebhookItem) => void;
  testCooldown: string | null;
}) {
  const toggling = false;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border bg-card/50 p-4 ${
        webhook.enabled ? "border-border" : "border-border/30 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5 ${
            webhook.enabled ? "bg-status-streaming/10 text-status-streaming" : "bg-muted text-muted-foreground"
          }`}>
            <Webhook className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {webhook.label && (
                <span className="text-sm font-medium text-foreground">{webhook.label}</span>
              )}
              {webhook.enabled ? (
                <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-status-online/10 text-status-online">
                  Active
                </span>
              ) : (
                <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  Disabled
                </span>
              )}
              {webhook.consecutive_failures > 0 && (
                <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                  {webhook.consecutive_failures} failures
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground/70 mt-0.5" title={webhook.url}>
              {truncateUrl(webhook.url)}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              Secret: <span className="font-mono">{webhook.secret_prefix}...</span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {effectiveWebhookEventTypes(webhook.event_types).map((eventType) => (
                <code key={eventType} className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[0.66rem] text-muted-foreground">
                  {eventType}
                </code>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[0.6875rem] text-muted-foreground/50">
              <span>Created {formatDate(webhook.created_at_unix)}</span>
              {webhook.created_by && <span>by {webhook.created_by}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30 flex-wrap">
        <Link href={`/dashboard/admin/companies/${cid}/api/webhooks/${webhook.webhook_id}`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 text-xs ${webhook.enabled ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-status-online"}`}
          onClick={() => onToggle(webhook)}
          disabled={toggling}
        >
          {webhook.enabled ? (
            <><PowerOff className="h-3 w-3 mr-1" /> Disable</>
          ) : (
            <><Power className="h-3 w-3 mr-1" /> Enable</>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onRotate(webhook)}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Rotate Secret
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onTest(webhook)}
          disabled={testCooldown === webhook.webhook_id}
        >
          <Send className="h-3 w-3 mr-1" />
          {testCooldown === webhook.webhook_id ? "Sent" : "Send Test"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(webhook)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
      </div>
    </motion.div>
  );
}

/* ── Main Page ── */

export default function WebhooksPage() {
  const params = useParams();
  const router = useRouter();
  const cid = params.cid as string;

  const [authed, setAuthed] = useState(false);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealSecret, setRevealSecret] = useState<CreateWebhookResponse | null>(null);
  const [rotateTarget, setRotateTarget] = useState<WebhookItem | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateResult, setRotateResult] = useState<CreateWebhookResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testCooldown, setTestCooldown] = useState<string | null>(null);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWebhooks(cid);
      setWebhooks(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, [cid]);

  useEffect(() => {
    if (hasAdminKey()) {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) loadWebhooks();
  }, [authed, loadWebhooks]);

  const handleCreate = async (url: string, label: string, eventTypes: WebhookEventType[]) => {
    setCreating(true);
    try {
      const res = await createWebhook(cid, url, label, eventTypes);
      setShowCreate(false);
      setRevealSecret(res);
      await loadWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (wh: WebhookItem) => {
    try {
      await updateWebhook(cid, wh.webhook_id, { enabled: !wh.enabled });
      toast.success(wh.enabled ? "Webhook disabled" : "Webhook enabled");
      await loadWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle webhook");
    }
  };

  const handleRotate = async () => {
    if (!rotateTarget) return;
    setRotating(true);
    try {
      const res = await rotateWebhookSecret(cid, rotateTarget.webhook_id);
      setRotateTarget(null);
      setRotateResult(res);
      await loadWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rotate secret");
    } finally {
      setRotating(false);
    }
  };

  const handleTest = async (wh: WebhookItem) => {
    try {
      await sendTestEvent(cid, wh.webhook_id);
      toast.success("Test event enqueued");
      setTestCooldown(wh.webhook_id);
      setTimeout(() => setTestCooldown(null), 10000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test event");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWebhook(cid, deleteTarget.webhook_id);
      toast.success("Webhook deleted");
      setDeleteTarget(null);
      await loadWebhooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete webhook");
    } finally {
      setDeleting(false);
    }
  };

  if (!authed) {
    return (
      <AdminKeyGate
        onUnlock={() => {
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push(`/dashboard/admin/companies/${cid}/api`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to API Overview
      </button>

      {/* Tab navigation */}
      <TabNav cid={cid} active="webhooks" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-status-streaming" />
          <h1 className="text-lg font-semibold text-foreground">Webhooks</h1>
          <span className="text-xs text-muted-foreground">{webhooks.length} total</span>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Webhook
        </Button>
      </div>

      {/* Webhook list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30">
          <Webhook className="h-8 w-8 text-muted-foreground/30" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/80">No webhooks yet</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Add a webhook endpoint to receive event notifications</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="mt-2">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {webhooks.map((wh) => (
              <WebhookCard
                key={wh.webhook_id}
                webhook={wh}
                cid={cid}
                onToggle={handleToggle}
                onRotate={setRotateTarget}
                onTest={handleTest}
                onDelete={setDeleteTarget}
                testCooldown={testCooldown}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create webhook modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateWebhookModal
            onCreate={handleCreate}
            onCancel={() => setShowCreate(false)}
            loading={creating}
          />
        )}
      </AnimatePresence>

      {/* Reveal secret modal (create) */}
      <AnimatePresence>
        {revealSecret && (
          <RevealSecretModal
            secret={revealSecret.signing_secret}
            title="Signing Secret Created"
            onDone={() => setRevealSecret(null)}
          />
        )}
      </AnimatePresence>

      {/* Rotate secret confirmation */}
      <AnimatePresence>
        {rotateTarget && !rotateResult && (
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
                  <p className="text-sm text-muted-foreground font-mono">{truncateUrl(rotateTarget.url, 35)}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This will generate a new signing secret. The old secret will stop working immediately. Make sure your endpoint is ready to use the new secret.
              </p>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setRotateTarget(null)} disabled={rotating}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleRotate} disabled={rotating}>
                  {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rotate Secret"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reveal secret modal (rotate) */}
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
        {deleteTarget && (
          <DeleteWebhookModal
            webhook={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
