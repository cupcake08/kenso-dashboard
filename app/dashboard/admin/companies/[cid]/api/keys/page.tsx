"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Loader2, Key, Plus, Copy, CheckCircle2, XCircle,
  AlertTriangle, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminFetch, setAdminKey, hasAdminKey,
  listAPIKeys, generateAPIKey, revokeAPIKey,
} from "@/lib/admin-api";
import type { APIKeyItem, GenerateKeyResponse } from "@/lib/admin-api";
import { toast } from "sonner";

/* ── Helpers ── */

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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
        <Link
          key={tab.id}
          href={tab.href}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            active === tab.id
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {active === tab.id && (
            <motion.div
              layoutId="api-tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
              transition={{ duration: 0.2 }}
            />
          )}
        </Link>
      ))}
    </div>
  );
}

/* ── Generate Key Modal ── */

function GenerateKeyModal({
  onGenerated,
  onCancel,
}: {
  onGenerated: (response: GenerateKeyResponse) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!label.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await generateAPIKey(
        (GenerateKeyModal as unknown as { _cid?: string })._cid || "",
        label.trim()
      );
      onGenerated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate key");
    } finally {
      setLoading(false);
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
        className="bg-background rounded-2xl border border-border p-6 max-w-md mx-4 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Generate New API Key</h3>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Production server, Staging"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && label.trim() && handleSubmit()}
          />
          <p className="text-[0.6875rem] text-muted-foreground/50 mt-1">
            A descriptive label to identify this key later
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!label.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Key"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Reveal Key Modal ── */

function RevealKeyModal({
  rawKey,
  onDone,
}: {
  rawKey: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawKey);
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
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">API Key Created</h3>
            <p className="text-xs text-muted-foreground">Copy this key now. It will not be shown again.</p>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-lg border border-border bg-card/50 p-3 pr-12">
            <code className="text-sm font-mono text-foreground break-all select-all">
              {rawKey}
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
            I have saved this key in a secure location
          </span>
        </label>

        <Button className="w-full" onClick={onDone} disabled={!confirmed}>
          Done
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ── Revoke Key Modal ── */

function RevokeKeyModal({
  keyItem,
  onConfirm,
  onCancel,
  loading,
}: {
  keyItem: APIKeyItem;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");

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
            <h3 className="text-base font-semibold text-foreground">Revoke API Key</h3>
            <p className="text-sm text-muted-foreground">{keyItem.key_prefix}...</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          This action is irreversible. Any integrations using this key will immediately stop working.
        </p>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Reason for revocation (required)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Key compromised, rotating credentials"
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
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke Key"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Key Card ── */

function KeyCard({
  keyItem,
  onRevoke,
}: {
  keyItem: APIKeyItem;
  onRevoke: (key: APIKeyItem) => void;
}) {
  const isRevoked = !!keyItem.revoked_at_unix;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border bg-card/50 p-4 ${
        isRevoked ? "border-border/30 opacity-60" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5 ${
            isRevoked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          }`}>
            <Key className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{keyItem.label}</span>
              {isRevoked ? (
                <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  Revoked
                </span>
              ) : (
                <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-status-online/10 text-status-online">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground/70 mt-0.5">{keyItem.key_prefix}...</p>
            <div className="flex items-center gap-3 mt-1.5 text-[0.6875rem] text-muted-foreground/50">
              <span>Created {formatDate(keyItem.created_at_unix)}</span>
              {keyItem.created_by && <span>by {keyItem.created_by}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[0.6875rem] text-muted-foreground/50">
              {keyItem.last_used_at_unix ? (
                <span>Last used {formatDate(keyItem.last_used_at_unix)}</span>
              ) : (
                <span>Never used</span>
              )}
            </div>
            {isRevoked && keyItem.revoke_reason && (
              <p className="text-[0.6875rem] text-muted-foreground/40 mt-1 italic">
                Reason: {keyItem.revoke_reason}
              </p>
            )}
          </div>
        </div>
        {!isRevoked && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(keyItem)}
            className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
          >
            Revoke
          </Button>
        )}
      </div>
    </motion.div>
  );
}

/* ── Main Page ── */

export default function APIKeysPage() {
  const params = useParams();
  const router = useRouter();
  const cid = params.cid as string;

  const [authed, setAuthed] = useState(false);
  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [revealKey, setRevealKey] = useState<GenerateKeyResponse | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<APIKeyItem | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAPIKeys(cid);
      setKeys(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load API keys");
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
    if (authed) loadKeys();
  }, [authed, loadKeys]);

  const handleGenerate = async (label: string) => {
    setGenerating(true);
    try {
      const res = await generateAPIKey(cid, label);
      setShowGenerate(false);
      setRevealKey(res);
      await loadKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (reason: string) => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeAPIKey(cid, revokeTarget.key_hash, reason);
      toast.success(`Key ${revokeTarget.key_prefix}... revoked`);
      setRevokeTarget(null);
      await loadKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke key");
    } finally {
      setRevoking(false);
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

  const activeKeys = keys.filter((k) => !k.revoked_at_unix);
  const revokedKeys = keys.filter((k) => !!k.revoked_at_unix);

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
      <TabNav cid={cid} active="keys" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">API Keys</h1>
          <span className="text-xs text-muted-foreground">{activeKeys.length} active</span>
        </div>
        <Button size="sm" onClick={() => setShowGenerate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Generate New Key
        </Button>
      </div>

      {/* Key list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30">
          <Key className="h-8 w-8 text-muted-foreground/30" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/80">No API keys yet</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Generate your first key to get started</p>
          </div>
          <Button size="sm" onClick={() => setShowGenerate(true)} className="mt-2">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Generate Key
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active keys */}
          {activeKeys.length > 0 && (
            <div className="space-y-3">
              <AnimatePresence>
                {activeKeys.map((k) => (
                  <KeyCard key={k.key_hash} keyItem={k} onRevoke={setRevokeTarget} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Revoked keys */}
          {revokedKeys.length > 0 && (
            <div className="space-y-3 pt-4">
              <h3 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">
                Revoked ({revokedKeys.length})
              </h3>
              <AnimatePresence>
                {revokedKeys.map((k) => (
                  <KeyCard key={k.key_hash} keyItem={k} onRevoke={setRevokeTarget} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Generate key modal */}
      <AnimatePresence>
        {showGenerate && (
          <GenerateKeyModalInline
            cid={cid}
            onGenerated={(res) => {
              setShowGenerate(false);
              setRevealKey(res);
              loadKeys();
            }}
            onCancel={() => setShowGenerate(false)}
            loading={generating}
            setLoading={setGenerating}
          />
        )}
      </AnimatePresence>

      {/* Reveal key modal */}
      <AnimatePresence>
        {revealKey && (
          <RevealKeyModal
            rawKey={revealKey.raw_key}
            onDone={() => setRevealKey(null)}
          />
        )}
      </AnimatePresence>

      {/* Revoke key modal */}
      <AnimatePresence>
        {revokeTarget && (
          <RevokeKeyModal
            keyItem={revokeTarget}
            onConfirm={handleRevoke}
            onCancel={() => setRevokeTarget(null)}
            loading={revoking}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Inline Generate Modal (uses cid from props) ── */

function GenerateKeyModalInline({
  cid,
  onGenerated,
  onCancel,
  loading,
  setLoading,
}: {
  cid: string;
  onGenerated: (res: GenerateKeyResponse) => void;
  onCancel: () => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!label.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await generateAPIKey(cid, label.trim());
      onGenerated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate key");
    } finally {
      setLoading(false);
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
        className="bg-background rounded-2xl border border-border p-6 max-w-md mx-4 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Generate New API Key</h3>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Production server, Staging"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && label.trim() && handleSubmit()}
          />
          <p className="text-[0.6875rem] text-muted-foreground/50 mt-1">
            A descriptive label to identify this key later
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!label.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Key"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
