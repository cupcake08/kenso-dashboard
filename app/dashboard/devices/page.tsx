"use client";
import { useState } from "react";
import { apiFetch, normalizeDevice, enableMic, disableMic, whoami } from "@/lib/api";
import type { Device, RawDevice } from "@/types/api";
import { useApi } from "@/hooks/use-api";
import { DeviceCard } from "@/components/dashboard/device-card";
import { DeviceCardSkeleton } from "@/components/ui/skeleton";
import { Radio } from "lucide-react";
import { toast } from "sonner";

const DEMO_DEVICES: Device[] = [
  { device_id: "dev_001_koramangala", shop_id: "shop_001", label: "Store - Koramangala", location: "Koramangala, Bangalore", status: "streaming", last_seen_at: new Date().toISOString() },
  { device_id: "dev_002_indiranagar", shop_id: "shop_002", label: "Store - Indiranagar", location: "Indiranagar, Bangalore", status: "online", last_seen_at: new Date(Date.now() - 300000).toISOString() },
  { device_id: "dev_003_whitefield", shop_id: "shop_003", label: "Store - Whitefield", location: "Whitefield, Bangalore", status: "offline", last_seen_at: new Date(Date.now() - 7200000).toISOString() },
  { device_id: "dev_004_hsr", shop_id: "shop_004", label: "Store - HSR Layout", location: "HSR Layout, Bangalore", status: "pending", last_seen_at: new Date(Date.now() - 60000).toISOString() },
];

const DEMO_COMPANY_ID = "comp_demo_acme_retail";
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function DevicesPage() {
  const [togglingDeviceId, setTogglingDeviceId] = useState<string | null>(null);

  // SWR: devices list with 30s polling, stale-while-revalidate
  const { data: devices = [], isLoading, error, mutate } = useApi<Device[]>(
    isDemoMode ? null : "/devices",
    async (url) => {
      const raw = await apiFetch<RawDevice[]>(url);
      return raw.map(normalizeDevice);
    },
    { refreshInterval: 30000, fallbackData: isDemoMode ? DEMO_DEVICES : undefined },
  );

  // SWR: company ID for enable/disable actions
  const { data: companyId = "" } = useApi<string>(
    isDemoMode ? null : "/_whoami_company",
    async () => {
      const who = await whoami();
      const active = who?.memberships?.find((m) => m.status === "active");
      return active?.company_id ?? "";
    },
    { fallbackData: isDemoMode ? DEMO_COMPANY_ID : undefined },
  );

  const handleToggleDevice = async (device: Device, action: "enable" | "disable") => {
    if (action === "disable" && !confirm("Disable this device? Streaming will stop.")) return;
    if (!companyId) return;
    setTogglingDeviceId(device.device_id);
    try {
      if (action === "enable") {
        await enableMic(companyId, device.device_id);
      } else {
        await disableMic(companyId, device.device_id);
      }
      mutate(); // revalidate devices list
      toast.success(action === "enable" ? "Device enabled" : "Device disabled");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} device`;
      toast.error(msg);
    } finally {
      setTogglingDeviceId(null);
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Loading devices…</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <DeviceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Devices</h1>
        </div>
        <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-400">Unable to load devices. Check your connection and try again.</p>
          <button onClick={() => mutate()} className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 ml-4 shrink-0">Retry</button>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Devices</h1>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6">
          <div className="relative rounded-2xl border border-dashed border-border p-10 flex flex-col items-center gap-4 max-w-md text-center">
            <div className="absolute -top-px left-1/2 -translate-x-1/2 h-px w-24 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Radio className="h-8 w-8 text-primary/70" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-foreground">No devices yet</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Provision your first device to start monitoring audio at your locations.
              Devices appear here automatically after they register.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {devices.length} device{devices.length !== 1 ? "s" : ""} in your organization
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => (
          <DeviceCard
            key={device.device_id}
            device={device}
            onToggle={companyId ? handleToggleDevice : undefined}
            toggling={togglingDeviceId === device.device_id}
          />
        ))}
      </div>
    </div>
  );
}
