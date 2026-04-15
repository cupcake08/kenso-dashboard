"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Loader2, Power, PowerOff, Key, Webhook, Activity,
  Truck, BarChart3, AlertOctagon, ArrowLeft, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminFetch, getAdminKey, setAdminKey, hasAdminKey,
  getCompanyAPIStatus, toggleCompanyAPI, listAPIKeys,
} from "@/lib/admin-api";
import type { CompanyAPIStatus, APIKeyItem } from "@/lib/admin-api";
import { toast } from "sonner";

/* ── Types ── */

interface SummaryTile {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
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

/* ── Kill Switch Confirmation ── */

function KillSwitchModal({
  companyName,
  enabling,
  onConfirm,
  onCancel,
  loading,
}: {
  companyName: string;
  enabling: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const confirmed = enabling ? true : confirmText === companyName;

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
          {enabling ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-online/10">
              <Power className="h-5 w-5 text-status-online" />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <PowerOff className="h-5 w-5 text-destructive" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {enabling ? "Enable API Access" : "Disable API Access"}
            </h3>
            <p className="text-sm text-muted-foreground">{companyName}</p>
          </div>
        </div>

        {!enabling && (
          <p className="text-sm text-muted-foreground">
            This will immediately block all API requests for this company. All active webhooks and integrations will stop.
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={enabling ? "Reason for enabling (optional)" : "Reason for disabling (required)"}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {!enabling && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Type <span className="font-mono text-foreground">{companyName}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Company name"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            variant={enabling ? "default" : "destructive"}
            onClick={() => onConfirm(reason)}
            disabled={!confirmed || (!enabling && !reason.trim()) || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : enabling ? "Enable" : "Disable"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
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

/* ── Main Page ── */

export default function CompanyAPIOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const cid = params.cid as string;

  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState<CompanyAPIStatus | null>(null);
  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showKillModal, setShowKillModal] = useState<"enable" | "disable" | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [apiStatus, apiKeys] = await Promise.all([
        getCompanyAPIStatus(cid),
        listAPIKeys(cid),
      ]);
      setStatus(apiStatus);
      setKeys(apiKeys ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load company data");
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
    if (authed) loadData();
  }, [authed, loadData]);

  const handleToggleAPI = async (reason: string) => {
    if (!status) return;
    const enabling = !status.api_enabled;
    setToggling(true);
    try {
      const res = await toggleCompanyAPI(cid, enabling, reason);
      setStatus((prev) => prev ? { ...prev, api_enabled: res.api_enabled } : prev);
      toast.success(enabling ? "API access enabled" : "API access disabled");
      setShowKillModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle API");
    } finally {
      setToggling(false);
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

  const tiles: SummaryTile[] = [
    { label: "Active API Keys", value: String(activeKeys.length), icon: <Key className="h-4 w-4" />, color: "text-status-online" },
    { label: "Webhooks", value: "0", icon: <Webhook className="h-4 w-4" />, color: "text-status-streaming" },
    { label: "API Calls (24h)", value: "\u2014", icon: <Activity className="h-4 w-4" />, color: "text-muted-foreground" },
    { label: "Deliveries (24h)", value: "\u2014", icon: <Truck className="h-4 w-4" />, color: "text-muted-foreground" },
    { label: "Success Rate", value: "\u2014", icon: <BarChart3 className="h-4 w-4" />, color: "text-muted-foreground" },
    { label: "Perm Failures", value: "\u2014", icon: <AlertOctagon className="h-4 w-4" />, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard/admin/billing")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Billing Admin
      </button>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Company header + kill switch */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card/50 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {status?.company_name || "Company"}
                </h1>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">{cid}</span>
                  {status?.api_enabled ? (
                    <span className="inline-flex items-center gap-1 text-[0.6875rem] px-2 py-0.5 rounded-full bg-status-online/10 text-status-online">
                      <CheckCircle2 className="h-3 w-3" /> API Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[0.6875rem] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      <XCircle className="h-3 w-3" /> API Disabled
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={status?.api_enabled ? "destructive" : "default"}
                onClick={() => setShowKillModal(status?.api_enabled ? "disable" : "enable")}
                className="shrink-0"
              >
                {status?.api_enabled ? (
                  <><PowerOff className="h-3.5 w-3.5 mr-1.5" /> Disable API</>
                ) : (
                  <><Power className="h-3.5 w-3.5 mr-1.5" /> Enable API</>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {tiles.map((tile, i) => (
              <motion.div
                key={tile.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card/40 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={tile.color}>{tile.icon}</span>
                  <span className="text-[0.6875rem] text-muted-foreground">{tile.label}</span>
                </div>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{tile.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Tab navigation */}
          <TabNav cid={cid} active="overview" />
        </>
      )}

      {/* Kill switch modal */}
      <AnimatePresence>
        {showKillModal && status && (
          <KillSwitchModal
            companyName={status.company_name}
            enabling={showKillModal === "enable"}
            onConfirm={handleToggleAPI}
            onCancel={() => setShowKillModal(null)}
            loading={toggling}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
