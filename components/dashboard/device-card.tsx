"use client";
import { motion } from "framer-motion";
import { Mic, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransitionLink } from "@/components/transition-link";
import type { Device } from "@/types/api";

interface DeviceCardProps {
  device: Device;
  onToggle?: (device: Device, action: "enable" | "disable") => void;
  toggling?: boolean;
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
  if (status === "pending") {
    return <span className="h-3 w-3 rounded-full bg-yellow-500" />;
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

export function DeviceCard({ device, onToggle, toggling }: DeviceCardProps) {
  const lastSeen = device.last_seen_at
    ? new Date(device.last_seen_at).toLocaleString()
    : "—";

  const isPending = device.status === "pending";
  const isOnline = device.status === "online" || device.status === "streaming";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
      style={{ viewTransitionName: `device-${device.device_id}` }}
      className="group relative rounded-xl border border-border bg-card/50 p-5 shadow-lg hover:border-muted-foreground/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={device.status} />
          <h3 className="font-semibold text-foreground">{device.label || "Unnamed Device"}</h3>
        </div>
        <span
          className={cn(
            "text-xs font-medium capitalize",
            device.status === "online" && "text-primary",
            device.status === "offline" && "text-red-400",
            device.status === "streaming" && "text-blue-400",
            device.status === "pending" && "text-yellow-500"
          )}
        >
          {device.status}
        </span>
      </div>

      {/* Location */}
      {device.location && (
        <p className="mt-1 text-sm text-muted-foreground">{device.location}</p>
      )}

      {/* Device ID */}
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        {device.device_id.slice(0, 12)}…
      </p>

      {/* Last seen */}
      <p className="mt-1 text-xs text-muted-foreground">Last seen: {lastSeen}</p>

      {/* Actions */}
      {device.status !== "pending" && (
        <div className="mt-4 flex gap-2">
          <TransitionLink
            href={`/dashboard/devices/${device.device_id}`}
            transitionName={`device-${device.device_id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted py-2 text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Mic className="h-4 w-4" />
            Listen
          </TransitionLink>
          <TransitionLink
            href={`/dashboard/devices/${device.device_id}?tab=report`}
            transitionName={`device-${device.device_id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-input py-2 text-sm font-medium text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <BarChart3 className="h-4 w-4" />
            Reports
          </TransitionLink>
        </div>
      )}

      {/* Enable / Disable */}
      {onToggle && isPending && (
        <div className="mt-3">
          <button
            onClick={() => onToggle(device, "enable")}
            disabled={toggling}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {toggling ? "Enabling…" : "Enable Device"}
          </button>
        </div>
      )}
      {onToggle && isOnline && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onToggle(device, "disable")}
            disabled={toggling}
            className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {toggling ? "Disabling…" : "Disable"}
          </button>
        </div>
      )}
    </motion.div>
  );
}
