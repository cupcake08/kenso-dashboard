"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TransitionLink } from "@/components/transition-link";
import type { Device } from "@/types/api";

interface DeviceCardProps {
  device: Device;
  onToggle?: (device: Device, action: "enable" | "disable") => void;
  toggling?: boolean;
}

function timeAgo(isoString: string): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
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
  const colors: Record<Device["status"], string> = {
    online: "bg-emerald-500",
    streaming: "bg-blue-500",
    offline: "bg-red-400",
    pending: "bg-amber-400",
  };
  return (
    <span className="relative flex h-2 w-2 shrink-0 mt-px" aria-label={status}>
      {status === "streaming" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", colors[status])} />
    </span>
  );
}

export function DeviceCard({ device, onToggle, toggling }: DeviceCardProps) {
  const isPending = device.status === "pending";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
      className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/25"
    >
      {/* Label + status */}
      <div className="flex items-center gap-2">
        <StatusDot status={device.status} />
        <h3 className="flex-1 truncate font-medium text-foreground text-sm">
          {device.label || "Unnamed Device"}
        </h3>
        <span className={cn(
          "text-xs shrink-0",
          device.status === "online" && "text-emerald-600",
          device.status === "streaming" && "text-blue-500",
          device.status === "offline" && "text-muted-foreground/50",
          device.status === "pending" && "text-amber-500",
        )}>
          {device.status}
        </span>
      </div>

      {/* Location + last seen */}
      <div className="mt-2">
        {device.location && (
          <p className="text-sm text-muted-foreground truncate">{device.location}</p>
        )}
        <p className="text-xs text-muted-foreground/50 mt-0.5">
          {timeAgo(device.last_seen_at)}
        </p>
      </div>

      {/* Actions */}
      {!isPending && (
        <div className="mt-4 flex items-center gap-4">
          <TransitionLink
            href={`/dashboard/devices/${device.device_id}`}
            transitionName={`device-${device.device_id}`}
            className="flex-1 rounded-lg bg-primary py-1.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Listen
          </TransitionLink>
          <TransitionLink
            href={`/dashboard/devices/${device.device_id}?tab=report`}
            transitionName={`device-${device.device_id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Reports →
          </TransitionLink>
        </div>
      )}

      {isPending && onToggle && (
        <button
          onClick={() => onToggle(device, "enable")}
          disabled={toggling}
          className="mt-4 w-full rounded-lg bg-primary py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {toggling ? "Enabling…" : "Enable Device"}
        </button>
      )}
    </motion.div>
  );
}
