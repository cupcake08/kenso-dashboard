"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield, Loader2, ArrowLeft, FileText, Clock, Key, Hash,
  Globe, Activity, RefreshCw, SlidersHorizontal, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeVariant } from "@/components/ui/badge-variant";
import {
  adminFetch, setAdminKey, hasAdminKey, listAuditLog,
} from "@/lib/admin-api";
import type { AuditLogEntry, AuditLogFilters, AuditLogSource } from "@/lib/admin-api";
import { toast } from "sonner";

type AuditFilterForm = {
  limit: string;
  source: AuditLogSource | "";
  action: string;
  method: string;
  statusCode: string;
  requestId: string;
  keyPrefix: string;
};

const DEFAULT_FILTER_FORM: AuditFilterForm = {
  limit: "50",
  source: "",
  action: "",
  method: "",
  statusCode: "",
  requestId: "",
  keyPrefix: "",
};

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "enterprise_api_request", label: "API Requests" },
  { value: "enterprise_api_enabled_updated", label: "API Enabled Updated" },
  { value: "enterprise_api_key_generated", label: "API Key Generated" },
  { value: "enterprise_api_key_revoked", label: "API Key Revoked" },
  { value: "enterprise_webhook_created", label: "Webhook Created" },
  { value: "enterprise_webhook_updated", label: "Webhook Updated" },
  { value: "enterprise_webhook_deleted", label: "Webhook Deleted" },
  { value: "enterprise_webhook_secret_rotated", label: "Webhook Secret Rotated" },
  { value: "enterprise_webhook_test_sent", label: "Webhook Test Sent" },
  { value: "enterprise_webhook_delivery_retried", label: "Webhook Delivery Retried" },
];

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function sourceLabel(source: AuditLogSource): string {
  switch (source) {
    case "api_request":
      return "API Request";
    case "api_request_legacy":
      return "Legacy Request";
    case "admin_action":
      return "Admin Action";
    default:
      return source;
  }
}

function sourceVariant(source: AuditLogSource): "emerald" | "amber" | "blue" | "slate" {
  switch (source) {
    case "api_request":
      return "blue";
    case "api_request_legacy":
      return "amber";
    case "admin_action":
      return "slate";
    default:
      return "slate";
  }
}

function statusClasses(statusCode?: number): string {
  if (!statusCode) return "bg-muted text-muted-foreground";
  if (statusCode >= 500) return "bg-destructive/10 text-destructive";
  if (statusCode >= 400) return "bg-status-pending/10 text-status-pending";
  if (statusCode >= 200) return "bg-status-online/10 text-status-online";
  return "bg-muted text-muted-foreground";
}

function buildFilters(form: AuditFilterForm): AuditLogFilters {
  const method = form.method.trim().toUpperCase();
  const statusCode = form.statusCode.trim();
  return {
    limit: Number(form.limit || "50"),
    source: form.source,
    action: form.action.trim() || undefined,
    method: method || undefined,
    request_id: form.requestId.trim() || undefined,
    key_prefix: form.keyPrefix.trim() || undefined,
    status_code: statusCode ? Number(statusCode) : undefined,
  };
}

function hasActiveFilters(filters: AuditLogFilters): boolean {
  return Boolean(
    filters.source
    || filters.action
    || filters.method
    || filters.request_id
    || filters.key_prefix
    || typeof filters.status_code === "number"
    || (filters.limit && filters.limit !== 50)
  );
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

/* ── Main Page ── */

export default function AuditLogPage() {
  const params = useParams();
  const router = useRouter();
  const cid = params.cid as string;

  const [authed, setAuthed] = useState(false);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterForm, setFilterForm] = useState<AuditFilterForm>(DEFAULT_FILTER_FORM);
  const [appliedFilters, setAppliedFilters] = useState<AuditLogFilters>(buildFilters(DEFAULT_FILTER_FORM));

  const loadAuditLog = useCallback(async (filters: AuditLogFilters, mode: "initial" | "refresh") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const data = await listAuditLog(cid, filters);
      setEntries(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cid]);

  useEffect(() => {
    if (hasAdminKey()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    void loadAuditLog(appliedFilters, "initial");
  }, [authed, appliedFilters, loadAuditLog]);

  const handleApplyFilters = () => {
    setAppliedFilters(buildFilters(filterForm));
  };

  const handleResetFilters = () => {
    setFilterForm(DEFAULT_FILTER_FORM);
    setAppliedFilters(buildFilters(DEFAULT_FILTER_FORM));
  };

  const handleRefresh = () => {
    void loadAuditLog(appliedFilters, "refresh");
  };

  const activeFilters = hasActiveFilters(appliedFilters);

  if (!authed) {
    return <AdminKeyGate onUnlock={() => setAuthed(true)} />;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/dashboard/admin/companies/${cid}/api`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to API Overview
      </button>

      <TabNav cid={cid} active="audit" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Audit Log</h1>
          <span className="text-xs text-muted-foreground">{entries.length} entries</span>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading} className="gap-2 self-start sm:self-auto">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Filter audit traffic</p>
            <p className="text-xs text-muted-foreground">Narrow by source, action, method, request ID, key prefix, or response status.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Source</label>
            <select
              value={filterForm.source}
              onChange={(e) => setFilterForm((prev) => ({ ...prev, source: e.target.value as AuditLogSource | "" }))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All sources</option>
              <option value="api_request">API Request</option>
              <option value="api_request_legacy">Legacy Request</option>
              <option value="admin_action">Admin Action</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Action</label>
            <select
              value={filterForm.action}
              onChange={(e) => setFilterForm((prev) => ({ ...prev, action: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Method</label>
            <select
              value={filterForm.method}
              onChange={(e) => setFilterForm((prev) => ({ ...prev, method: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Limit</label>
            <select
              value={filterForm.limit}
              onChange={(e) => setFilterForm((prev) => ({ ...prev, limit: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Status Code</label>
            <input
              type="number"
              value={filterForm.statusCode}
              onChange={(e) => setFilterForm((prev) => ({ ...prev, statusCode: e.target.value }))}
              placeholder="e.g. 201"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Key Prefix</label>
            <input
              type="text"
              value={filterForm.keyPrefix}
              onChange={(e) => setFilterForm((prev) => ({ ...prev, keyPrefix: e.target.value }))}
              placeholder="ks_123"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Request ID</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="text"
                value={filterForm.requestId}
                onChange={(e) => setFilterForm((prev) => ({ ...prev, requestId: e.target.value }))}
                placeholder="req_..."
                className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {activeFilters
              ? "Showing filtered audit activity across API requests and admin changes."
              : "Showing the most recent enterprise API traffic and admin actions for this company."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetFilters} disabled={loading || refreshing}>
              Reset
            </Button>
            <Button onClick={handleApplyFilters} disabled={loading || refreshing}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30"
        >
          <FileText className="h-10 w-10 text-muted-foreground/20" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/80">
              {activeFilters ? "No audit entries match these filters" : "No audit entries yet"}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">
              {activeFilters
                ? "Try widening the source, method, or status filters."
                : "API requests, key rotations, webhook operations, and admin changes will appear here."}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Timestamp</span>
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Request</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Key className="h-3 w-3" /> Key</span>
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Outcome</span>
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> IP Address</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.entry_id} className="border-b border-border/60 align-top last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{formatDate(entry.timestamp_unix)}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.request_id ? (
                            <code className="rounded bg-muted/60 px-1.5 py-0.5 text-[0.7rem]">{entry.request_id}</code>
                          ) : "No request ID"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <BadgeVariant variant={sourceVariant(entry.source)}>
                          {sourceLabel(entry.source)}
                        </BadgeVariant>
                        <p className="text-xs text-muted-foreground break-all">{entry.action}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5 min-w-[20rem]">
                        <p className="font-medium text-foreground">{entry.summary || entry.action}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {entry.method && (
                            <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground/80">
                              {entry.method}
                            </span>
                          )}
                          {entry.path && (
                            <code className="break-all rounded bg-muted/60 px-1.5 py-0.5">{entry.path}</code>
                          )}
                        </div>
                        {entry.error_code && (
                          <p className="text-xs text-destructive">{entry.error_code}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {entry.key_prefix ? (
                        <code className="rounded bg-muted/60 px-1.5 py-0.5 text-xs text-foreground">{entry.key_prefix}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(entry.status_code)}`}>
                          {entry.status_code ?? "—"}
                        </span>
                        <p className="text-xs text-muted-foreground">{entry.error_code ? "Error" : "Response"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {entry.remote_addr ? (
                        <code className="text-xs text-muted-foreground break-all">{entry.remote_addr}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border/50 p-3">
        <Activity className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground/50">
          This log now combines public enterprise API requests with admin key and webhook changes. Use request IDs and key prefixes to trace customer integrations end-to-end.
        </p>
      </div>
    </div>
  );
}
