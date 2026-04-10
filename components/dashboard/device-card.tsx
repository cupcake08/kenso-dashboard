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

type StatusKey = Device["status"];

const STATUS: Record<StatusKey, { dot: string; badge: string; label: string }> = {
  online:    { dot: "bg-emerald-500",    badge: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",  label: "Online"  },
  streaming: { dot: "bg-blue-500",       badge: "bg-blue-500/10 text-blue-400 ring-blue-500/20",            label: "Live"    },
  offline:   { dot: "bg-slate-500",      badge: "bg-slate-500/10 text-slate-400 ring-slate-500/20",         label: "Offline" },
  pending:   { dot: "bg-amber-400",      badge: "bg-amber-400/10 text-amber-400 ring-amber-400/20",         label: "Setup"   },
};

function StatusDot({ status }: { status: StatusKey }) {
  const { dot } = STATUS[status];
  return (
    <span className="relative flex h-2 w-2 shrink-0 mt-[3px]" aria-hidden>
      {status === "streaming" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-50" />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
    </span>
  );
}

export function DeviceCard({ device, onToggle, toggling }: DeviceCardProps) {
  const { badge, label } = STATUS[device.status];
  const isPending = device.status === "pending";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
      className={cn(
        "group relative rounded-2xl border border-border/60 p-4",
        "bg-gradient-to-b from-[hsl(217_33%_11%)] to-[hsl(217_33%_7%)]",
        "shadow-[inset_0_1px_0_0_hsl(215_14%_20%)]",
        "transition-all duration-200",
        "hover:border-muted-foreground/20 hover:shadow-[inset_0_1px_0_0_hsl(215_14%_24%),0_0_0_1px_hsl(215_14%_20%)]",
      )}
    >
      {/* Header — name + status pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={device.status} />
          <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
            {device.label || "Unnamed Device"}
          </h3>
        </div>
        <span className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ring-1",
          badge,
        )}>
          {label}
        </span>
      </div>

      {/* Location + last seen — indented to align under label */}
      <div className="mt-2 pl-4 space-y-0.5">
        {device.location && (
          <p className="text-xs text-muted-foreground truncate">{device.location}</p>
        )}
        <p className="text-[11px] tabular-nums text-muted-foreground/40">
          {timeAgo(device.last_seen_at)}
        </p>
      </div>

      {/* Actions */}
      {!isPending ? (
        <TransitionLink
          href={`/dashboard/devices/${device.device_id}`}
          transitionName={`device-${device.device_id}`}
          className={cn(
            "mt-4 block w-full rounded-xl py-2 text-center text-sm font-semibold text-primary-foreground",
            "bg-primary transition-all duration-150",
            "hover:brightness-110 hover:shadow-[0_0_16px_-4px_hsl(160_84%_39%/0.6)]",
            "active:scale-[0.97] active:shadow-none",
          )}
        >
          Listen
        </TransitionLink>
      ) : (
        onToggle && (
          <button
            onClick={() => onToggle(device, "enable")}
            disabled={toggling}
            className={cn(
              "mt-4 w-full rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground",
              "transition-all duration-150",
              "hover:brightness-110 hover:shadow-[0_0_16px_-4px_hsl(160_84%_39%/0.5)]",
              "active:scale-[0.97] active:shadow-none",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {toggling ? "Enabling…" : "Enable Device"}
          </button>
        )
      )}
    </motion.div>
  );
}
