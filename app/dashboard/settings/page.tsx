"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { apiFetch, normalizeDevice, generateAPIKey, rotateAPIKey } from "@/lib/api";
import type { Device, PlanResponse, RawDevice, RawPlanResponse, UsageResponse } from "@/types/api";
import { useApi } from "@/hooks/use-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, RefreshCw, Key, User, CreditCard, Cpu, Check, AlertCircle, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { User as FirebaseUser } from "firebase/auth";

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

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.33, 1, 0.68, 1] as const },
};

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
  const { data: devices = [], isLoading: loading, mutate: mutateDevices } = useApi<Device[]>(
    isDemoMode ? null : "/devices",
    async (url) => {
      const raw = await apiFetch<RawDevice[]>(url);
      return raw.map(normalizeDevice);
    },
    { fallbackData: isDemoMode ? DEMO_DEVICES_SETTINGS : undefined },
  );

  // Sync labels when devices load/change
  useEffect(() => {
    const init: Record<string, string> = {};
    devices.forEach((d) => { init[d.device_id] = d.label; });
    setLabels(init);
  }, [devices]);

  // Get Firebase user for display
  useEffect(() => {
    if (isDemoMode) return;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      if (!auth) return;
      const unsub = onAuthStateChanged(auth, setUser);
      return () => unsub();
    });
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

      {/* API Key */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className="rounded-xl border border-border bg-card/50 p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <Key className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">API Key</p>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Call the Analysis API programmatically with the{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-[0.6875rem] font-mono text-foreground/80">X-API-Key</code>{" "}
          header.
        </p>

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
              <p className="text-xs text-muted-foreground/60">Store this key securely. You won't be able to view it again.</p>
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
