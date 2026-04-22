"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  apiFetch,
  normalizeDevice,
  generateAPIKey,
  rotateAPIKey,
  getSandboxStatus,
  provisionSandboxWorkspace,
  listWorkspaceWebhooks,
  createWorkspaceWebhook,
  updateWorkspaceWebhook,
  deleteWorkspaceWebhook,
  rotateWorkspaceWebhookSecret,
  sendWorkspaceWebhookTest,
  listWorkspaceWebhookDeliveries,
  retryWorkspaceWebhookDelivery,
  setSelectedCompanyId,
} from "@/lib/api";
import type { Device, PlanResponse, RawDevice, RawPlanResponse, UsageResponse } from "@/types/api";
import { useApi } from "@/hooks/use-api";
import { useBusinessType } from "@/hooks/use-business-type";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, RefreshCw, Key, User, CreditCard, Cpu, Check, AlertCircle, LogOut, Building2, ChevronRight, FlaskConical, ArrowRightLeft, BadgeCheck, Webhook, Trash2, BellRing, TimerReset, Clock3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { User as FirebaseUser } from "firebase/auth";
import type { SandboxStatusResponse, WorkspaceWebhook, WorkspaceWebhookDelivery, WorkspaceWebhookSecretResponse } from "@/lib/api";

const VERTICAL_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  retail: "Retail",
  ticketing: "Ticketing",
  service: "Service",
  generic: "Generic",
};

function businessTypeSourceLabel(source: string, setAtUnix?: number): string {
  const dateStr = setAtUnix
    ? new Date(setAtUnix * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  if (source === "admin") return dateStr ? `Set by you on ${dateStr}` : "Set by you";
  if (source === "ai_confirmed") return dateStr ? `AI-confirmed on ${dateStr}` : "AI-confirmed";
  return "Not set";
}

const DEMO_PLAN: PlanResponse = { plan: "Analyze Pro", billing_cycle: "prepaid", price_per_month: 99900 };
const DEMO_USAGE_PLAN: Partial<UsageResponse> = {
  plan_display_name: "Analyze Pro",
  commitment_level: "Annual",
  monthly_rate_per_device_inr: 999,
  overage_rate_per_hour_inr: 40,
  total_monthly_inr: 2997,
  analyze_devices: 3,
  included_hours_per_device: 100,
};
const DEMO_DEVICES_SETTINGS: Device[] = [
  { device_id: "dev_001", shop_id: "shop_001", label: "Store - Koramangala", location: "Bangalore", status: "streaming", last_seen_at: new Date().toISOString() },
];

// Stable empty-array reference. Using `[]` inline (e.g. `data ?? []`) creates
// a new array every render and breaks useEffect deps that compare by identity.
const EMPTY_DEVICES: Device[] = [];

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.33, 1, 0.68, 1] as const },
};

const TRANSIENT_DELIVERY_STATUSES = new Set(["pending", "in_flight", "retrying"]);

function isTransientDelivery(status: string): boolean {
  return TRANSIENT_DELIVERY_STATUSES.has(status);
}

function getDeliveryStatusMeta(status: string) {
  switch (status) {
    case "delivered":
      return {
        label: "Delivered",
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        detail: "Receiver accepted the signed payload.",
      };
    case "in_flight":
      return {
        label: "Delivering",
        className: "border-sky-500/20 bg-sky-500/10 text-sky-300",
        detail: "Worker is actively posting the payload.",
      };
    case "retrying":
      return {
        label: "Retrying",
        className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
        detail: "The previous attempt failed and another attempt is scheduled.",
      };
    case "failed_permanently":
      return {
        label: "Failed",
        className: "border-red-500/20 bg-red-500/10 text-red-300",
        detail: "Delivery exhausted its retry policy.",
      };
    case "pending":
    default:
      return {
        label: "Queued",
        className: "border-border bg-muted text-muted-foreground",
        detail: "Waiting for the webhook worker to pick it up.",
      };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [savedOk, setSavedOk] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatusResponse | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxProvisioning, setSandboxProvisioning] = useState(false);
  const [sandboxSwitching, setSandboxSwitching] = useState(false);
  const [webhooks, setWebhooks] = useState<WorkspaceWebhook[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [webhookActionId, setWebhookActionId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookLabel, setWebhookLabel] = useState("");
  const [webhookCreating, setWebhookCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<WorkspaceWebhookSecretResponse | null>(null);
  const [deliveriesByWebhook, setDeliveriesByWebhook] = useState<Record<string, WorkspaceWebhookDelivery[]>>({});
  const [deliveryLoadingId, setDeliveryLoadingId] = useState<string | null>(null);

  // SWR: business type
  const { state: btState } = useBusinessType();

  // SWR: plan info (legacy format)
  const { data: plan = null } = useApi<PlanResponse | null>(
    isDemoMode ? null : "/billing/plan",
    async (url) => apiFetch<RawPlanResponse>(url).catch(() => null),
    { fallbackData: isDemoMode ? DEMO_PLAN : null },
  );

  // SWR: usage — provides enriched plan fields (commitment level, overage rate, etc.)
  const { data: usagePlan } = useApi<Partial<UsageResponse>>(
    isDemoMode ? null : "/usage",
    async (url) => apiFetch<UsageResponse>(url).catch(() => ({})),
    { fallbackData: isDemoMode ? DEMO_USAGE_PLAN : {} },
  );

  // SWR: devices (shared cache key with devices list page)
  const { data: devicesData, isLoading: loading, mutate: mutateDevices } = useApi<Device[]>(
    isDemoMode ? null : "/devices",
    async (url) => {
      const raw = await apiFetch<RawDevice[]>(url);
      return raw.map(normalizeDevice);
    },
    { fallbackData: isDemoMode ? DEMO_DEVICES_SETTINGS : undefined },
  );
  // Stable empty default — destructuring with `= []` creates a fresh array
  // on every render when data is undefined, which would retrigger the
  // label-sync effect below infinitely during auth-pending renders.
  const devices = devicesData ?? EMPTY_DEVICES;

  // Sync labels when devices load/change. Depend on a stable signature
  // (id+label pairs) instead of the array reference — SWR gives a new
  // array each revalidation even when content is identical.
  const devicesSignature = devices.map((d) => `${d.device_id}:${d.label}`).join("|");
  useEffect(() => {
    const init: Record<string, string> = {};
    devices.forEach((d) => { init[d.device_id] = d.label; });
    setLabels(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicesSignature]);

  // Get Firebase user for display
  useEffect(() => {
    if (isDemoMode) return;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      if (!auth) return;
      const unsub = onAuthStateChanged(auth, setUser);
      return () => unsub();
    });
  }, []);

  useEffect(() => {
    if (isDemoMode) return;
    let cancelled = false;
    setSandboxLoading(true);
    void getSandboxStatus()
      .then((status) => {
        if (!cancelled) setSandboxStatus(status);
      })
      .catch(() => {
        if (!cancelled) setSandboxStatus(null);
      })
      .finally(() => {
        if (!cancelled) setSandboxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isDemoMode) return;
    let cancelled = false;
    setWebhooksLoading(true);
    void listWorkspaceWebhooks()
      .then((items) => {
        if (!cancelled) setWebhooks(items ?? []);
      })
      .catch(() => {
        if (!cancelled) setWebhooks([]);
      })
      .finally(() => {
        if (!cancelled) setWebhooksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveLabel(deviceId: string) {
    const originalLabel = devices.find((d) => d.device_id === deviceId)?.label ?? "";
    const newLabel = labels[deviceId];
    if (newLabel === originalLabel) return;
    setSaving(deviceId);
    setSavedOk(null);
    // Optimistic update
    mutateDevices(devices.map((d) => d.device_id === deviceId ? { ...d, label: newLabel } : d), { revalidate: false });
    try {
      await apiFetch(`/devices/${deviceId}`, { method: "PATCH", body: JSON.stringify({ label: newLabel }) });
      mutateDevices(); // revalidate with server
      setSavedOk(deviceId);
      toast.success("Device label updated");
      setTimeout(() => setSavedOk(null), 2000);
    } catch (e) {
      setLabels((prev) => ({ ...prev, [deviceId]: originalLabel }));
      mutateDevices(); // rollback — refetch actual state
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-28" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    );
  }

  // Prefer enriched usage-plan data, fall back to legacy plan fields
  const planName = usagePlan?.plan_display_name ?? plan?.plan ?? "Free";
  const commitmentLevel = usagePlan?.commitment_level ?? "";
  const overageRate = usagePlan?.overage_rate_per_hour_inr;
  const monthlyRatePerDevice = usagePlan?.monthly_rate_per_device_inr;
  const totalMonthly = usagePlan?.total_monthly_inr;
  const analyzeDevices = usagePlan?.analyze_devices;
  // Legacy fallback price label (old format uses paise, new format uses INR directly)
  const legacyPriceLabel = plan?.price_per_month
    ? `\u20B9${(plan.price_per_month / 100).toLocaleString()}/mo`
    : null;
  const billingLabel = plan?.billing_cycle === "postpaid" ? "Postpaid" : "Prepaid";
  const currentEnvironment = sandboxStatus?.current_environment ?? "production";
  const fixtureRows = sandboxStatus?.fixtures ?? [];

  const formatSandboxWindow = (startUnix: number, endUnix: number) =>
    `${new Date(startUnix * 1000).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })} UTC - ${new Date(endUnix * 1000).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })} UTC`;

  const switchDashboardEnvironment = async (targetCompanyId: string, targetEnvironment: "production" | "sandbox") => {
    if (!targetCompanyId) return;
    setSandboxSwitching(true);
    try {
      setApiKey(null);
      const [status, webhookItems] = await Promise.all([
        getSandboxStatus(targetCompanyId),
        listWorkspaceWebhooks(targetCompanyId),
      ]);
      if (status.current_company_id !== targetCompanyId) {
        throw new Error("Workspace switch verification failed");
      }
      setSelectedCompanyId(targetCompanyId);
      setSandboxStatus(status);
      setWebhooks(webhookItems ?? []);
      setDeliveriesByWebhook({});
      setRevealedSecret(null);
      toast.success(targetEnvironment === "sandbox" ? "Switched to sandbox workspace" : "Returned to production workspace");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch workspace");
    } finally {
      setSandboxSwitching(false);
    }
  };

  const formatWorkspaceTime = (unix?: number) =>
    unix
      ? new Date(unix * 1000).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "Never";

  const fetchDeliveries = async (webhookId: string) => {
    const rows = await listWorkspaceWebhookDeliveries(webhookId);
    setDeliveriesByWebhook((prev) => ({ ...prev, [webhookId]: rows ?? [] }));
    return rows ?? [];
  };

  const loadDeliveries = async (webhookId: string) => {
    setDeliveryLoadingId(webhookId);
    try {
      await fetchDeliveries(webhookId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setDeliveryLoadingId(null);
    }
  };

  const watchQueuedDelivery = async (webhookId: string, deliveryId: string) => {
    setDeliveryLoadingId(webhookId);
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const rows = await fetchDeliveries(webhookId);
        const target = rows.find((row) => row.delivery_id === deliveryId);
        if (target && !isTransientDelivery(target.status)) {
          if (target.status === "delivered") {
            toast.success("Test delivered to your receiver");
          } else {
            toast.error(target.last_error || "Test delivery failed");
          }
          return;
        }
        if (attempt < 5) {
          await sleep(attempt === 0 ? 1200 : 1800);
        }
      }
      toast.success("Test queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to track delivery");
    } finally {
      setDeliveryLoadingId(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground leading-normal">Account, billing, and device configuration</p>
      </div>

      {/* Profile + Plan */}
      <div className="grid gap-4 sm:grid-cols-5">
        {/* Profile — takes 3 cols */}
        <motion.div {...fadeUp} className="sm:col-span-3 rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Profile</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary text-lg font-bold shrink-0">
              {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground truncate leading-tight">
                {user?.displayName ?? "User"}
              </p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </motion.div>

        {/* Plan — takes 2 cols */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }} className="sm:col-span-2 rounded-xl border border-border bg-card/50 p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Plan</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-xl font-bold text-foreground tracking-tight capitalize leading-snug">{planName}</p>
            {commitmentLevel && (
              <span className="text-[0.6875rem] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                {commitmentLevel}
              </span>
            )}
          </div>
          {monthlyRatePerDevice != null && analyzeDevices != null ? (
            <div className="space-y-1 mt-1">
              <p className="text-sm text-muted-foreground">
                ₹{monthlyRatePerDevice.toLocaleString("en-IN")}/device/month
              </p>
              {totalMonthly != null && (
                <p className="text-base font-semibold text-foreground">
                  ₹{totalMonthly.toLocaleString("en-IN")}/month
                </p>
              )}
              {overageRate != null && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  ₹{overageRate}/hour beyond included
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1.5 leading-none">
              {legacyPriceLabel ?? "Free"} · {billingLabel}
            </p>
          )}
        </motion.div>
      </div>

      {/* Business Type */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.075 }}>
        <Link
          href="/dashboard/settings/business-type"
          className="block rounded-xl border border-border bg-card/50 p-5 hover:border-primary/30 hover:bg-primary/5 transition-colors duration-200 group"
        >
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Business Type</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
          </div>

          {btState?.businessType && VERTICAL_LABELS[btState.businessType] ? (
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold text-foreground tracking-tight leading-[1.1]">
                {VERTICAL_LABELS[btState.businessType]}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {businessTypeSourceLabel(btState.source, btState.setAtUnix)}
              </p>
              {btState.description && (
                <p className="text-[0.8125rem] text-foreground/60 mt-3 line-clamp-2 italic leading-relaxed max-w-prose">
                  &ldquo;{btState.description}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold text-foreground tracking-tight leading-[1.1]">
                Set your business type
              </p>
              <p className="text-[0.8125rem] text-muted-foreground mt-2 leading-relaxed max-w-prose">
                Picking a vertical tunes AI analysis for restaurants, retail, or service — sharper metrics, more relevant summaries.
              </p>
            </div>
          )}
        </Link>
      </motion.div>

      {/* Device Labels */}
      {devices.length > 0 && (
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Devices</p>
            <span className="text-xs text-muted-foreground/60 ml-auto tabular-nums">{devices.length} connected</span>
          </div>
          <div className="space-y-2.5">
            {devices.map((device) => (
              <div key={device.device_id} className="flex items-center gap-2.5">
                <div className="flex-1 min-w-0">
                  <Input
                    value={labels[device.device_id] ?? ""}
                    onChange={(e) => {
                      setLabels((prev) => ({ ...prev, [device.device_id]: e.target.value }));
                      setSavedOk(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && saveLabel(device.device_id)}
                    placeholder="Device label"
                  />
                </div>
                <Button
                  size="sm"
                  variant={savedOk === device.device_id ? "default" : "outline"}
                  onClick={() => saveLabel(device.device_id)}
                  disabled={saving === device.device_id || labels[device.device_id] === device.label}
                  className="min-w-[4.5rem] transition-all"
                >
                  {saving === device.device_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : savedOk === device.device_id ? (
                    <><Check className="h-3.5 w-3.5 mr-1" />Saved</>
                  ) : "Save"}
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sandbox */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.14 }} className="rounded-xl border border-border bg-card/50 p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sandbox Workspace</p>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
            currentEnvironment === "sandbox"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-muted text-muted-foreground border border-border"
          }`}>
            {currentEnvironment === "sandbox" ? "Sandbox active" : "Production active"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Create an isolated sandbox workspace with seeded test windows, fake credits, deterministic results, and real webhook deliveries for integration testing.
        </p>

        {sandboxLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : sandboxStatus?.provisioned ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-background/45 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{sandboxStatus.sandbox_display_name ?? "Sandbox workspace"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Fixture bundle {sandboxStatus.sandbox_fixture_version ?? "current"} · same API host, sandbox-scoped keys, fake credits only.
                  </p>
                </div>
                <BadgeCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {currentEnvironment === "sandbox" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sandboxSwitching || !sandboxStatus.root_company_id}
                    onClick={() => void switchDashboardEnvironment(sandboxStatus.root_company_id, "production")}
                  >
                    {sandboxSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />}
                    Back To Production
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={sandboxSwitching || !sandboxStatus.sandbox_company_id}
                    onClick={() => void switchDashboardEnvironment(sandboxStatus.sandbox_company_id ?? "", "sandbox")}
                  >
                    {sandboxSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />}
                    Switch To Sandbox
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href="/docs#sandbox" target="_blank" rel="noreferrer">
                    Sandbox Guide
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {fixtureRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Seeded Fixtures</p>
                <div className="space-y-2">
                  {fixtureRows.map((fixture) => (
                    <div key={fixture.fixture_id} className="rounded-xl border border-border/70 bg-background/45 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{fixture.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{fixture.description}</p>
                        </div>
                        <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[0.6875rem] font-mono text-foreground/80">
                          {fixture.expected_terminal_status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <p><span className="text-foreground/80">Template:</span> <code className="font-mono">{fixture.template_id}</code></p>
                        <p><span className="text-foreground/80">Mic:</span> <code className="font-mono">{fixture.mic_id}</code></p>
                        <p><span className="text-foreground/80">Name:</span> {fixture.mic_name}</p>
                        <p><span className="text-foreground/80">Window:</span> {formatSandboxWindow(fixture.time_range_start_unix, fixture.time_range_end_unix)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Provision a hosted sandbox workspace before generating sandbox keys. The seeded fixtures are stable, webhook-safe, and designed for smoke tests and integration validation.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={sandboxProvisioning}
                onClick={async () => {
                  setSandboxProvisioning(true);
                  try {
                    const status = await provisionSandboxWorkspace();
                    setSandboxStatus(status);
                    toast.success("Sandbox workspace provisioned");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to provision sandbox");
                  } finally {
                    setSandboxProvisioning(false);
                  }
                }}
              >
                {sandboxProvisioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
                Provision Sandbox
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/docs#sandbox" target="_blank" rel="noreferrer">
                  Read Sandbox Docs
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Webhooks */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.145 }} className="rounded-xl border border-border bg-card/50 p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <Webhook className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Webhooks</p>
          <span className="ml-auto rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[0.6875rem] font-medium text-foreground/80">
            {currentEnvironment === "sandbox" ? "Sandbox workspace" : "Production workspace"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Configure callback endpoints for the current workspace, send signed test events, and inspect recent deliveries before switching your integration live.
        </p>

        {revealedSecret && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Signing secret ready</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Save this secret now. It will not be shown again after you close this notice.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(revealedSecret.signing_secret);
                  toast.success("Signing secret copied");
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy
              </Button>
            </div>
            <code className="mt-3 block overflow-x-auto rounded-lg border border-border/70 bg-background/60 px-3 py-2.5 text-[0.75rem] font-mono text-foreground/90">
              {revealedSecret.signing_secret}
            </code>
          </div>
        )}

        <div className="rounded-xl border border-border/70 bg-background/45 p-4">
          <p className="text-sm font-medium text-foreground">Add endpoint</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use a public HTTPS receiver. Sandbox test sends use the same signature format and retry machinery as production deliveries.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr),12rem,auto]">
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhooks/knownsense"
            />
            <Input
              value={webhookLabel}
              onChange={(e) => setWebhookLabel(e.target.value)}
              placeholder="Primary receiver"
            />
            <Button
              disabled={webhookCreating || !webhookUrl.trim()}
              onClick={async () => {
                setWebhookCreating(true);
                try {
                  const created = await createWorkspaceWebhook(webhookUrl.trim(), webhookLabel.trim());
                  setRevealedSecret(created);
                  setWebhookUrl("");
                  setWebhookLabel("");
                  setWebhooks(await listWorkspaceWebhooks());
                  toast.success("Webhook created");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to create webhook");
                } finally {
                  setWebhookCreating(false);
                }
              }}
            >
              {webhookCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Webhook className="h-4 w-4 mr-2" />}
              Add Webhook
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {webhooksLoading ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : webhooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-4">
              <p className="text-sm text-muted-foreground">
                No webhook endpoints configured for the current workspace yet.
              </p>
            </div>
          ) : (
            webhooks.map((webhook) => {
              const deliveries = deliveriesByWebhook[webhook.webhook_id] ?? [];
              const recentDeliveries = deliveries.slice(0, 4);
              return (
                <div
                  key={webhook.webhook_id}
                  className="rounded-2xl border border-border/70 bg-background/45 px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_18px_40px_rgba(2,6,23,0.18)]"
                >
                  <div className="flex flex-col gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{webhook.label || "Webhook endpoint"}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium border ${
                          webhook.enabled
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-border bg-muted text-muted-foreground"
                        }`}>
                          {webhook.enabled ? "Enabled" : "Disabled"}
                        </span>
                        {webhook.consecutive_failures > 0 && (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-300">
                            {webhook.consecutive_failures} failures
                          </span>
                        )}
                        {deliveryLoadingId === webhook.webhook_id && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-sky-300">
                            <Clock3 className="h-3 w-3" />
                            Updating
                          </span>
                        )}
                      </div>
                      <div className="mt-3 rounded-xl border border-border/70 bg-background/70 px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,0.025)_inset]">
                        <p className="text-[0.625rem] font-medium uppercase tracking-[0.24em] text-muted-foreground/80">Endpoint</p>
                        <code className="mt-1.5 block break-all text-[0.78rem] leading-relaxed text-foreground/85">
                          {webhook.url}
                        </code>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground tabular-nums">
                        <span className="rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
                          Secret prefix: <code className="font-mono text-foreground/80">{webhook.secret_prefix}...</code>
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
                          Created: {formatWorkspaceTime(webhook.created_at_unix)}
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
                          Last delivered: {formatWorkspaceTime(webhook.last_delivered_at_unix)}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10 justify-start active:scale-[0.96] transition-transform"
                        disabled={webhookActionId === webhook.webhook_id}
                        onClick={async () => {
                          setWebhookActionId(webhook.webhook_id);
                          try {
                            await updateWorkspaceWebhook(webhook.webhook_id, { enabled: !webhook.enabled });
                            setWebhooks(await listWorkspaceWebhooks());
                            toast.success(webhook.enabled ? "Webhook disabled" : "Webhook enabled");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to update webhook");
                          } finally {
                            setWebhookActionId(null);
                          }
                        }}
                      >
                        {webhookActionId === webhook.webhook_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : webhook.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10 justify-start active:scale-[0.96] transition-transform"
                        disabled={webhookActionId === webhook.webhook_id || deliveryLoadingId === webhook.webhook_id}
                        onClick={async () => {
                          setWebhookActionId(webhook.webhook_id);
                          try {
                            const queued = await sendWorkspaceWebhookTest(webhook.webhook_id);
                            toast.success("Signed test event queued");
                            void watchQueuedDelivery(webhook.webhook_id, queued.delivery_id);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to send test event");
                          } finally {
                            setWebhookActionId(null);
                          }
                        }}
                      >
                        <BellRing className="h-3.5 w-3.5 mr-1.5" />
                        Send Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10 justify-start active:scale-[0.96] transition-transform"
                        disabled={webhookActionId === webhook.webhook_id}
                        onClick={async () => {
                          setWebhookActionId(webhook.webhook_id);
                          try {
                            const rotated = await rotateWorkspaceWebhookSecret(webhook.webhook_id);
                            setRevealedSecret(rotated);
                            setWebhooks(await listWorkspaceWebhooks());
                            toast.success("Webhook secret rotated");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to rotate secret");
                          } finally {
                            setWebhookActionId(null);
                          }
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Rotate Secret
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10 justify-start active:scale-[0.96] transition-transform"
                        disabled={deliveryLoadingId === webhook.webhook_id}
                        onClick={() => void loadDeliveries(webhook.webhook_id)}
                      >
                        {deliveryLoadingId === webhook.webhook_id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <TimerReset className="h-3.5 w-3.5 mr-1.5" />}
                        Refresh Deliveries
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10 justify-start active:scale-[0.96] transition-transform"
                        disabled={webhookActionId === webhook.webhook_id}
                        onClick={async () => {
                          if (!confirm("Delete this webhook endpoint?")) return;
                          setWebhookActionId(webhook.webhook_id);
                          try {
                            await deleteWorkspaceWebhook(webhook.webhook_id);
                            setWebhooks(await listWorkspaceWebhooks());
                            setDeliveriesByWebhook((prev) => {
                              const next = { ...prev };
                              delete next[webhook.webhook_id];
                              return next;
                            });
                            toast.success("Webhook deleted");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to delete webhook");
                          } finally {
                            setWebhookActionId(null);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/55">
                      <div className="border-b border-border/50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Recent deliveries</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Send Test queues a signed webhook event and the worker posts it a few seconds later. Showing the latest {recentDeliveries.length} {recentDeliveries.length === 1 ? "delivery" : "deliveries"}.
                          </p>
                        </div>
                      </div>

                      {deliveries.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-muted-foreground">
                          No deliveries yet. Send a signed test event to validate your receiver before switching the integration live.
                        </div>
                      ) : (
                        <div className="divide-y divide-border/40">
                          {recentDeliveries.map((delivery) => {
                            const statusMeta = getDeliveryStatusMeta(delivery.status);
                            return (
                              <div key={delivery.delivery_id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <code className="rounded-md border border-border/70 bg-background/70 px-2 py-1 text-[0.72rem] text-foreground/90">
                                      {delivery.event_type}
                                    </code>
                                    <span className={`rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${statusMeta.className}`}>
                                      {statusMeta.label}
                                    </span>
                                    {delivery.last_response_status != null && delivery.last_response_status > 0 && (
                                      <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                                        HTTP {delivery.last_response_status}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground">{statusMeta.detail}</p>
                                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                                    <span>Created: {formatWorkspaceTime(delivery.created_at_unix)}</span>
                                    <span>Attempts: {delivery.attempts}</span>
                                    {delivery.status === "retrying" && delivery.next_attempt_at_unix && (
                                      <span>Next try: {formatWorkspaceTime(delivery.next_attempt_at_unix)}</span>
                                    )}
                                  </div>
                                  {delivery.last_error && (
                                    <p className="mt-2 text-xs text-red-300/90 text-pretty">{delivery.last_error}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 sm:justify-end">
                                  {(delivery.status === "retrying" || delivery.status === "failed_permanently") && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2.5 text-xs active:scale-[0.96] transition-transform"
                                      onClick={async () => {
                                        try {
                                          await retryWorkspaceWebhookDelivery(delivery.delivery_id);
                                          await loadDeliveries(webhook.webhook_id);
                                          toast.success("Delivery requeued");
                                        } catch (err) {
                                          toast.error(err instanceof Error ? err.message : "Failed to retry delivery");
                                        }
                                      }}
                                    >
                                      Retry
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* API Key */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className="rounded-xl border border-border bg-card/50 p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <Key className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">API Key</p>
          <span className="ml-auto rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[0.6875rem] font-medium text-foreground/80">
            {currentEnvironment === "sandbox" ? "Sandbox" : "Production"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Call the Analysis API programmatically with the{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-[0.6875rem] font-mono text-foreground/80">X-API-Key</code>{" "}
          header for the currently selected workspace.
        </p>

        <div className="mb-4 flex items-center justify-between rounded-xl border border-border/70 bg-background/45 px-3.5 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Developer docs</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Request examples, webhook verification, limits, and integration flow.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/docs" target="_blank" rel="noreferrer">
              Open Docs
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {apiKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-[0.8125rem] font-mono text-foreground overflow-x-auto select-all leading-relaxed">
                {apiKey}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                  setApiKeyCopied(true);
                  toast.success("API key copied");
                  setTimeout(() => setApiKeyCopied(false), 2000);
                }}
                className="shrink-0"
              >
                {apiKeyCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
              <p className="text-xs text-muted-foreground/60">Store this key securely. You won&apos;t be able to view it again.</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!confirm("Rotate API key? The current key will stop working immediately.")) return;
                  setApiKeyLoading(true);
                  try {
                    const key = await rotateAPIKey();
                    setApiKey(key);
                    toast.success("API key rotated");
                  } catch {
                    toast.error("Failed to rotate key");
                  } finally {
                    setApiKeyLoading(false);
                  }
                }}
                disabled={apiKeyLoading}
                className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`h-3 w-3 mr-1.5 ${apiKeyLoading ? "animate-spin" : ""}`} />
                Rotate
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={async () => {
              setApiKeyLoading(true);
              try {
                const key = await generateAPIKey();
                setApiKey(key);
                toast.success("API key generated");
              } catch {
                toast.error("Failed to generate key");
              } finally {
                setApiKeyLoading(false);
              }
            }}
            disabled={apiKeyLoading}
          >
            {apiKeyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
            Generate API Key
          </Button>
        )}
      </motion.div>

      {/* Sign Out */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
        <button
          onClick={async () => {
            if (!auth) return;
            const { signOut } = await import("firebase/auth");
            await signOut(auth);
            document.cookie = "firebase-token=; path=/; max-age=0";
            router.push("/login");
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/50 p-5 text-left text-muted-foreground hover:text-red-400 hover:border-red-400/20 hover:bg-red-400/5 transition-colors group"
        >
          <LogOut className="h-4 w-4 group-hover:text-red-400 transition-colors" />
          <div>
            <p className="text-sm font-medium text-foreground group-hover:text-red-400 transition-colors">Sign out</p>
            <p className="text-xs text-muted-foreground mt-0.5">End your session on this device</p>
          </div>
        </button>
      </motion.div>
    </div>
  );
}
