"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ChevronRight, Loader2, Play, AlertTriangle,
  Receipt, CreditCard, CheckCircle2, Clock, XCircle, Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminFetch, getAdminKey, setAdminKey, hasAdminKey } from "@/lib/admin-api";

/* ── Types ── */

interface CompanyItem {
  company_id: string;
  name: string;
  mic_count: number;
  subscription_state: string;
  trial_ends_at?: string;
  period_end?: string;
}

interface Subscription {
  state: string;
  plan_id: string;
  trial_ends_at: string;
  period_start: string;
  period_end: string;
  past_due_since?: string;
  cached_usage: {
    credits_used: number;
    overage_charges_inr: string;
    last_rolled_up_at: string;
  };
}

interface Invoice {
  invoice_id: string;
  period: string;
  status: string;
  issued_at?: string;
  due_at?: string;
  paid_at?: string;
  total_inr: string;
  payment_reference: string;
  line_items: { description: string; quantity: number; unit_price: string; amount: string }[];
}

interface BillingDetail {
  subscription: Subscription | null;
  invoices: Invoice[];
}

/* ── Helpers ── */

function formatDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string): number {
  if (!iso) return 0;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

const SUB_BADGES: Record<string, { label: string; cls: string }> = {
  trialing:    { label: "Trial",     cls: "bg-status-streaming/10 text-status-streaming" },
  trial_ended: { label: "Trial Ended", cls: "bg-status-pending/10 text-status-pending" },
  invoiced:    { label: "Invoiced",  cls: "bg-status-pending/10 text-status-pending" },
  active:      { label: "Active",    cls: "bg-status-online/10 text-status-online" },
  past_due:    { label: "Past Due",  cls: "bg-status-offline/10 text-status-offline" },
  suspended:   { label: "Suspended", cls: "bg-status-offline/10 text-status-offline" },
  cancelled:   { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

const INV_BADGES: Record<string, { cls: string }> = {
  draft:  { cls: "bg-muted text-muted-foreground" },
  issued: { cls: "bg-status-pending/10 text-status-pending" },
  paid:   { cls: "bg-status-online/10 text-status-online" },
  void:   { cls: "bg-muted text-muted-foreground line-through" },
};

/* ── API Key Gate ── */

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

/* ── Company Row ── */

function CompanyRow({ company, selected, onSelect }: {
  company: CompanyItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = SUB_BADGES[company.subscription_state] ?? { label: "No Plan", cls: "bg-muted text-muted-foreground" };
  const trialDays = company.trial_ends_at ? daysUntil(company.trial_ends_at) : null;

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/30 border border-transparent"
      }`}
    >
      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${selected ? "rotate-90" : ""}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[0.6875rem] text-muted-foreground/50 flex items-center gap-1">
            <Mic className="h-3 w-3" /> {company.mic_count}
          </span>
          {trialDays !== null && trialDays > 0 && company.subscription_state === "trialing" && (
            <span className="text-[0.6875rem] text-muted-foreground/50">{trialDays}d left</span>
          )}
        </div>
      </div>
      <span className={`text-[0.6875rem] px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
        {badge.label}
      </span>
    </button>
  );
}

/* ── Company Detail Panel ── */

function CompanyDetail({ companyId, companyName, onRefresh }: {
  companyId: string;
  companyName: string;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<BillingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminFetch<BillingDetail>(`/v2/admin/companies/${companyId}/billing`);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const startTrial = async () => {
    const days = prompt("Trial days (default 14):", "14");
    if (days === null) return;
    setActionLoading("trial");
    try {
      await adminFetch(`/v2/admin/companies/${companyId}/subscription/start`, {
        method: "POST",
        body: JSON.stringify({ trial_days: parseInt(days) || 14, plan_id: "basic" }),
      });
      await load();
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading("");
    }
  };

  const createInvoice = async () => {
    const desc = prompt("Description:", "Monthly subscription");
    if (!desc) return;
    const amount = prompt("Amount (INR, before GST):", "999");
    if (!amount) return;
    const period = new Date().toISOString().slice(0, 7); // "2026-04"
    setActionLoading("invoice");
    try {
      await adminFetch(`/v2/admin/companies/${companyId}/invoices`, {
        method: "POST",
        body: JSON.stringify({
          period,
          due_days: 15,
          line_items: [{ description: desc, quantity: 1, unit_price: amount }],
        }),
      });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading("");
    }
  };

  const markPaid = async (invoiceId: string) => {
    const ref = prompt("Bank reference / UTR number:");
    if (!ref) return;
    setActionLoading(invoiceId);
    try {
      await adminFetch(`/v2/admin/companies/${companyId}/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({ bank_reference: ref }),
      });
      await load();
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sub = detail?.subscription;
  const invoices = detail?.invoices ?? [];
  const subBadge = sub ? (SUB_BADGES[sub.state] ?? { label: sub.state, cls: "bg-muted text-muted-foreground" }) : null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="px-4 py-4 space-y-4 border-t border-border/30">
        {/* Subscription */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Subscription</h4>
          {sub ? (
            <div className="rounded-lg border border-border bg-card/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${subBadge!.cls}`}>{subBadge!.label}</span>
                {sub.plan_id && <span className="text-[0.6875rem] text-muted-foreground">{sub.plan_id}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[0.6875rem]">
                {sub.state === "trialing" && (
                  <div>
                    <span className="text-muted-foreground/50">Trial ends</span>
                    <p className="text-foreground">{formatDate(sub.trial_ends_at)}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground/50">Period end</span>
                  <p className="text-foreground">{formatDate(sub.period_end)}</p>
                </div>
                {sub.cached_usage && (
                  <div>
                    <span className="text-muted-foreground/50">Credits used</span>
                    <p className="text-foreground">{sub.cached_usage.credits_used}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card/20 p-3">
              <p className="text-sm text-muted-foreground">No subscription</p>
              <Button size="sm" onClick={startTrial} disabled={!!actionLoading}>
                {actionLoading === "trial" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Play className="h-3 w-3 mr-1" /> Start Trial</>}
              </Button>
            </div>
          )}
        </div>

        {/* Invoices */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoices</h4>
            <Button variant="ghost" size="sm" onClick={createInvoice} disabled={!!actionLoading} className="h-7 text-xs">
              {actionLoading === "invoice" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Receipt className="h-3 w-3 mr-1" /> New Invoice</>}
            </Button>
          </div>
          {invoices.length === 0 ? (
            <p className="text-[0.6875rem] text-muted-foreground/50 py-2">No invoices yet</p>
          ) : (
            <div className="space-y-1.5">
              {invoices.map((inv) => {
                const badge = INV_BADGES[inv.status] ?? { cls: "bg-muted text-muted-foreground" };
                return (
                  <div key={inv.invoice_id} className="flex items-center gap-3 rounded-lg border border-border bg-card/30 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[0.625rem] px-1.5 py-0.5 rounded-full ${badge.cls}`}>{inv.status}</span>
                        <span className="text-xs text-foreground font-medium">{inv.period}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[0.625rem] text-muted-foreground/50">
                        {inv.due_at && <span>Due {formatDate(inv.due_at)}</span>}
                        {inv.paid_at && <span>Paid {formatDate(inv.paid_at)}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-foreground tabular-nums shrink-0">
                      {"\u20B9"}{inv.total_inr || "0.00"}
                    </span>
                    {inv.status === "issued" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markPaid(inv.invoice_id)}
                        disabled={!!actionLoading}
                        className="h-7 text-xs shrink-0"
                      >
                        {actionLoading === inv.invoice_id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <><CheckCircle2 className="h-3 w-3 mr-1" /> Mark Paid</>
                        }
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Page ── */

export default function AdminBillingPage() {
  const [authed, setAuthed] = useState(false);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<CompanyItem[]>("/v2/admin/billing/companies");
      setCompanies(data);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAdminKey()) {
      setAuthed(true);
      loadCompanies();
    }
  }, [loadCompanies]);

  if (!authed) {
    return <AdminKeyGate onUnlock={() => { setAuthed(true); loadCompanies(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Billing Admin</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : companies.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30">
          <CreditCard className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No companies found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/30 divide-y divide-border/30">
          {companies.map((c) => (
            <div key={c.company_id}>
              <CompanyRow
                company={c}
                selected={selectedId === c.company_id}
                onSelect={() => setSelectedId(selectedId === c.company_id ? null : c.company_id)}
              />
              <AnimatePresence>
                {selectedId === c.company_id && (
                  <CompanyDetail
                    companyId={c.company_id}
                    companyName={c.name}
                    onRefresh={loadCompanies}
                  />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
