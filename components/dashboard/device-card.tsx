"use client";
import { memo } from "react";
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

// Returns null when timestamp is invalid/zero (Go zero time = 0001-01-01)
function timeAgo(isoString: string): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime()) || date.getFullYear() < 2020) return null;
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusDot({ status }: { status: Device["status"] }) {
  const label = status === "streaming" ? "Streaming" : status === "online" ? "Online" : status === "pending" ? "Pending" : "Offline";
  if (status === "streaming") {
    return (
      <span className="relative flex h-3 w-3" role="status" aria-label={label}>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-streaming opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-status-streaming" />
      </span>
    );
  }
  if (status === "pending") {
    return <span className="h-3 w-3 rounded-full bg-status-pending" role="status" aria-label={label} />;
  }
  return (
    <span role="status" aria-label={label} className={cn("h-3 w-3 rounded-full", status === "online" ? "bg-status-online" : "bg-status-offline")} />
  );
}

export const DeviceCard = memo(function DeviceCard({ device, onToggle, toggling }: DeviceCardProps) {
  const isPending = device.status === "pending";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
      style={{ viewTransitionName: `device-${device.device_id}` }}
      className="group relative flex flex-col rounded-xl border border-border bg-card/50 p-5 shadow-lg hover:border-muted-foreground/30"
    >
      {/* Zone 1 — Identity */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={device.status} />
          <h3 className="font-semibold text-foreground truncate">{device.label || "Unnamed Device"}</h3>
        </div>
        <span className={cn(
          "text-xs font-medium capitalize",
          device.status === "online" && "text-status-online",
          device.status === "offline" && "text-status-offline",
          device.status === "streaming" && "text-status-streaming",
          device.status === "pending" && "text-status-pending",
        )}>
          {device.status}
        </span>
      </div>

      {/* Zone 2 — Context (tight cluster) */}
      <div className="mt-2 space-y-0.5">
        {device.location && (
          <p className="text-sm text-muted-foreground">{device.location}</p>
        )}
        <p className="text-xs text-muted-foreground/70">
          {timeAgo(device.last_seen_at) ?? (
            device.status === "online" || device.status === "streaming"
              ? "Active"
              : device.status === "offline"
                ? "Last seen unknown"
                : null
          )}
        </p>
      </div>

      {/* Zone 3 — Actions (pushed to bottom for consistent card alignment) */}
      {!isPending && (
        <div className="mt-auto pt-5 flex gap-2">
          {device.status !== "offline" ? (
            <TransitionLink
              href={`/dashboard/devices/${device.device_id}`}
              transitionName={`device-${device.device_id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Mic className="h-4 w-4" />
              Listen
            </TransitionLink>
          ) : (
            <span className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted/50 py-2.5 text-sm font-medium text-muted-foreground/40 cursor-not-allowed">
              <Mic className="h-4 w-4" />
              Offline
            </span>
          )}
          <TransitionLink
            href={`/dashboard/devices/${device.device_id}?tab=report`}
            transitionName={`device-${device.device_id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-input py-2.5 text-sm font-medium text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <BarChart3 className="h-4 w-4" />
            Reports
          </TransitionLink>
        </div>
      )}

      {isPending && onToggle && (
        <button
          onClick={() => onToggle(device, "enable")}
          disabled={toggling}
          className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {toggling ? "Enabling…" : "Enable Device"}
        </button>
      )}
    </motion.div>
  );
});
