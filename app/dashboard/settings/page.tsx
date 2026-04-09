"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { apiFetch, normalizeDevice } from "@/lib/api";
import type { Device, PlanResponse, RawDevice, RawPlanResponse } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { SettingsSkeleton } from "@/components/ui/skeleton";

const DEMO_PLAN: PlanResponse = { plan: "Enterprise", billing_cycle: "prepaid", price_per_month: 29900 };
const DEMO_DEVICES_SETTINGS: Device[] = [
  { device_id: "dev_001_koramangala", shop_id: "shop_001", label: "Store - Koramangala", location: "Koramangala, Bangalore", status: "streaming", last_seen_at: new Date().toISOString() },
  { device_id: "dev_002_indiranagar", shop_id: "shop_002", label: "Store - Indiranagar", location: "Indiranagar, Bangalore", status: "online", last_seen_at: new Date(Date.now() - 300000).toISOString() },
  { device_id: "dev_003_whitefield", shop_id: "shop_003", label: "Store - Whitefield", location: "Whitefield, Bangalore", status: "offline", last_seen_at: new Date(Date.now() - 7200000).toISOString() },
  { device_id: "dev_004_hsr", shop_id: "shop_004", label: "Store - HSR Layout", location: "HSR Layout, Bangalore", status: "online", last_seen_at: new Date(Date.now() - 60000).toISOString() },
];

export default function SettingsPage() {
  const user = auth?.currentUser ?? null;
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState<string | null>(null);
  const [savingError, setSavingError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      setPlan(DEMO_PLAN);
      setDevices(DEMO_DEVICES_SETTINGS);
      const init: Record<string, string> = {};
      DEMO_DEVICES_SETTINGS.forEach((d) => { init[d.device_id] = d.label; });
      setLabels(init);
      setLoading(false);
      return;
    }
    if (!auth?.currentUser) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch<RawPlanResponse>("/billing/plan"),
      apiFetch<RawDevice[]>("/devices").then((raw) => {
        const devices = raw.map(normalizeDevice);
        setDevices(devices);
        const init: Record<string, string> = {};
        devices.forEach((d) => { init[d.device_id] = d.label; });
        setLabels(init);
        return devices;
      }),
    ])
      .then(([p]) => setPlan(p))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function saveLabel(deviceId: string) {
    const originalLabel = devices.find((d) => d.device_id === deviceId)?.label ?? "";
    const newLabel = labels[deviceId];
    if (newLabel === originalLabel) return;

    setSaving(deviceId);
    setSavingError("");
    setSavedOk(null);

    // Optimistic: update device list immediately
    setDevices((prev) =>
      prev.map((d) => d.device_id === deviceId ? { ...d, label: newLabel } : d)
    );

    try {
      await apiFetch(`/devices/${deviceId}`, {
        method: "PATCH",
        body: JSON.stringify({ label: newLabel }),
      });
      setSavedOk(deviceId);
      setTimeout(() => setSavedOk(null), 2000);
    } catch (e) {
      // Revert on failure
      setLabels((prev) => ({ ...prev, [deviceId]: originalLabel }));
      setDevices((prev) =>
        prev.map((d) => d.device_id === deviceId ? { ...d, label: originalLabel } : d)
      );
      setSavingError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, plan, and devices</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <p className="font-medium text-foreground">{user?.displayName ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground capitalize">{plan?.plan ?? "—"}</p>
              <p className="text-sm text-muted-foreground">
                {plan?.billing_cycle === "prepaid" ? "Prepaid billing" : "Postpaid"} · ₹{(plan?.price_per_month ?? 0) / 100}/month
              </p>
            </div>
            <BadgeVariant variant="emerald" className="capitalize">
              {plan?.billing_cycle ?? "—"}
            </BadgeVariant>
          </div>
        </CardContent>
      </Card>

      {/* Devices */}
      <Card>
        <CardHeader>
          <CardTitle>Device Labels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {devices.map((device) => (
            <div key={device.device_id} className="flex items-center gap-3">
              <Input
                value={labels[device.device_id] ?? ""}
                onChange={(e) => {
                  setLabels((prev) => ({ ...prev, [device.device_id]: e.target.value }));
                  setSavedOk(null);
                  setSavingError("");
                }}
                placeholder="Device label"
                className="flex-1"
              />
              <Button
                size="sm"
                variant={savedOk === device.device_id ? "default" : "outline"}
                onClick={() => saveLabel(device.device_id)}
                disabled={saving === device.device_id}
                className="min-w-[60px]"
              >
                {saving === device.device_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : savedOk === device.device_id ? (
                  "Saved"
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          ))}
          {savingError && (
            <p className="text-sm text-red-400">{savingError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
