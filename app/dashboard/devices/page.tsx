"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Device } from "@/types/api";
import { DeviceCard } from "@/components/dashboard/device-card";
import { Loader2, Radio } from "lucide-react";

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ devices: Device[] }>("/devices")
      .then(({ devices }) => setDevices(devices))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
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
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
        <Radio className="h-8 w-8" />
        <p className="text-sm">No devices found for your organization.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-50">Devices</h1>
        <p className="mt-1 text-sm text-slate-400">
          {devices.length} device{devices.length !== 1 ? "s" : ""} in your organization
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => (
          <DeviceCard key={device.device_id} device={device} />
        ))}
      </div>
    </div>
  );
}
