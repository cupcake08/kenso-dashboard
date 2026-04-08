"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Device } from "@/types/api";
import { DeviceCard } from "@/components/dashboard/device-card";
import { DeviceCardSkeleton } from "@/components/ui/skeleton";
import { Radio } from "lucide-react";

const DEMO_DEVICES: Device[] = [
  { device_id: "dev_001_koramangala", label: "Store - Koramangala", location: "Koramangala, Bangalore", status: "streaming", last_seen_at: new Date().toISOString(), shop_id: "shop_001" },
  { device_id: "dev_002_indiranagar", label: "Store - Indiranagar", location: "Indiranagar, Bangalore", status: "online", last_seen_at: new Date(Date.now() - 300000).toISOString(), shop_id: "shop_002" },
  { device_id: "dev_003_whitefield", label: "Store - Whitefield", location: "Whitefield, Bangalore", status: "offline", last_seen_at: new Date(Date.now() - 7200000).toISOString(), shop_id: "shop_003" },
  { device_id: "dev_004_hsr", label: "Store - HSR Layout", location: "HSR Layout, Bangalore", status: "online", last_seen_at: new Date(Date.now() - 60000).toISOString(), shop_id: "shop_004" },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      setDevices(DEMO_DEVICES);
      setLoading(false);
      return;
    }
    if (!auth?.currentUser) {
      setLoading(false);
      return;
    }
    apiFetch<{ devices: Device[] }>("/devices")
      .then(({ devices }) => setDevices(devices))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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
      <div className="rounded-xl border border-red-900 bg-red-950/30 p-6 text-red-400">
        {error}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Radio className="h-8 w-8" />
        <p className="text-sm">No devices found for your organization.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {devices.length} device{devices.length !== 1 ? "s" : ""} in your organization
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => (
          <DeviceCard key={device.device_id} device={device} />
        ))}
      </div>
    </div>
  );
}
