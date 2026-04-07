"use client";
import { motion } from "framer-motion";
import { Link } from "next/link";
import { Mic, Activity, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device } from "@/types/api";

interface DeviceCardProps {
  device: Device;
}

function StatusDot({ status }: { status: Device["status"] }) {
  if (status === "streaming") {
    return (
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "h-3 w-3 rounded-full",
        status === "online" ? "bg-emerald-500" : "bg-red-500"
      )}
    />
  );
}

export function DeviceCard({ device }: DeviceCardProps) {
  const lastSeen = device.last_seen_at
    ? new Date(device.last_seen_at).toLocaleString()
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}
      transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
      className="group relative rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={device.status} />
          <h3 className="font-semibold text-slate-50">{device.label || "Unnamed Device"}</h3>
        </div>
        <span
          className={cn(
            "text-xs font-medium capitalize",
            device.status === "online" && "text-emerald-400",
            device.status === "offline" && "text-red-400",
            device.status === "streaming" && "text-blue-400"
          )}
        >
          {device.status}
        </span>
      </div>

      {/* Location */}
      {device.location && (
        <p className="mt-1 text-sm text-slate-500">{device.location}</p>
      )}

      {/* Device ID */}
      <p className="mt-3 font-mono text-xs text-slate-600">
        {device.device_id.slice(0, 12)}…
      </p>

      {/* Last seen */}
      <p className="mt-1 text-xs text-slate-600">Last seen: {lastSeen}</p>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Link
          href={`/dashboard/devices/${device.device_id}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-sm font-medium text-slate-50 hover:bg-emerald-600 hover:text-white transition-colors"
        >
          <Mic className="h-4 w-4" />
          Listen
        </Link>
        <Link
          href={`/dashboard/devices/${device.device_id}?tab=report`}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-sm font-medium text-slate-400 hover:border-slate-600 hover:text-slate-50 transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
          Reports
        </Link>
      </div>
    </motion.div>
  );
}
