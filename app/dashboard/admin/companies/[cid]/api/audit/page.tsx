"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield, Loader2, ArrowLeft, FileText, Clock, Key, Hash,
  Globe, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminFetch, setAdminKey, hasAdminKey, listAuditLog,
} from "@/lib/admin-api";
import { toast } from "sonner";

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
  const [entries, setEntries] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAuditLog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAuditLog(cid);
      setEntries(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [cid]);

  useEffect(() => {
    if (hasAdminKey()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed) loadAuditLog();
  }, [authed, loadAuditLog]);

  if (!authed) {
    return <AdminKeyGate onUnlock={() => setAuthed(true)} />;
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
      <TabNav cid={cid} active="audit" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Audit Log</h1>
        <span className="text-xs text-muted-foreground">{entries.length} entries</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 rounded-xl" />
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
            <p className="text-sm font-medium text-foreground/80">No audit entries yet</p>
            <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">
              Audit logging will be populated as API requests are made.
              All key management, webhook operations, and API calls will appear here.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border overflow-hidden"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Timestamp
                  </span>
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1"><Key className="h-3 w-3" /> Key Prefix
                  </span>
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Status
                  </span>
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Summary</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> IP Address
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Entries will render here when backend returns data */}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border/50 p-3">
        <Activity className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground/50">
          The audit log tracks all administrative API actions including key generation, revocation,
          webhook creation, updates, and deletion. Entries will appear here as API activity occurs.
        </p>
      </div>
    </div>
  );
}
