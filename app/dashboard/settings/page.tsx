"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Device, PlanResponse } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const user = auth.currentUser;
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<PlanResponse>("/billing/plan"),
      apiFetch<{ devices: Device[] }>("/devices").then(({ devices }) => {
        setDevices(devices);
        const init: Record<string, string> = {};
        devices.forEach((d) => { init[d.device_id] = d.label; });
        setLabels(init);
        return devices;
      }),
    ])
      .then(([p]) => setPlan(p))
      .finally(() => setLoading(false));
  }, []);

  async function saveLabel(deviceId: string) {
    setSaving(deviceId);
    try {
      await apiFetch(`/devices/${deviceId}`, {
        method: "PATCH",
        body: JSON.stringify({ label: labels[deviceId] }),
      });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your profile, plan, and devices</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <p className="font-medium text-slate-50">{user?.displayName ?? "—"}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
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
              <p className="text-lg font-semibold text-slate-50 capitalize">{plan?.plan ?? "—"}</p>
              <p className="text-sm text-slate-500">
                {plan?.billing_cycle === "prepaid" ? "Prepaid billing" : "Postpaid"} · ₹{(plan?.price_per_month ?? 0) / 100}/month
              </p>
            </div>
            <span className="rounded-full bg-emerald-950/50 border border-emerald-800 px-3 py-1 text-sm font-medium text-emerald-400 capitalize">
              {plan?.billing_cycle ?? "—"}
            </span>
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
                onChange={(e) => setLabels((prev) => ({ ...prev, [device.device_id]: e.target.value }))}
                placeholder="Device label"
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveLabel(device.device_id)}
                disabled={saving === device.device_id}
              >
                {saving === device.device_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
