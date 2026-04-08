"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mic, Clock, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Device, WindowSummary } from "@/types/api";
import { Loader2, Play, Pause } from "lucide-react";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Skeleton, WindowSkeleton } from "@/components/ui/skeleton";
import { Waveform } from "@/components/ui/waveform";

type Tab = "listen" | "recent" | "report";

const DEMO_DEVICE: Device = {
  device_id: "dev_001_koramangala",
  label: "Store - Koramangala",
  location: "Koramangala, Bangalore",
  status: "streaming",
  last_seen_at: new Date().toISOString(),
  shop_id: "shop_001",
};
const DEMO_WINDOWS: WindowSummary[] = [
  { window_id: "win_001", started_at: new Date(Date.now() - 3600000).toISOString(), duration_minutes: 30, status: "completed", highlights: ["Customer asked about pricing", "Payment received via UPI", "Staff handled refund request"], flags_count: 1, summary: "Busy morning with good customer flow. Payment activity normal. One policy deviation flagged." },
  { window_id: "win_002", started_at: new Date(Date.now() - 5400000).toISOString(), duration_minutes: 30, status: "completed", highlights: ["Bulk order inquiry", "Delivery scheduling discussion"], flags_count: 0, summary: "Moderate traffic. Two significant business conversations noted." },
  { window_id: "win_003", started_at: new Date(Date.now() - 10800000).toISOString(), duration_minutes: 30, status: "completed", highlights: ["Customer complaint about stock"], flags_count: 2, summary: "Elevated flag activity. One complaint about missing stock, one policy violation noted." },
];

export default function DeviceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const deviceId = params.id as string;
  const initialTab = (searchParams.get("tab") as Tab) ?? "listen";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [device, setDevice] = useState<Device | null>(null);
  const [windows, setWindows] = useState<WindowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWindow, setSelectedWindow] = useState<WindowSummary | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      setDevice(DEMO_DEVICE);
      setWindows(DEMO_WINDOWS);
      setLoading(false);
      return;
    }
    if (!auth?.currentUser) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch<{ device: Device }>(`/devices/${deviceId}`).then(({ device }) => device),
      apiFetch<{ windows: WindowSummary[] }>(`/devices/${deviceId}/windows`).then(({ windows }) => windows),
    ])
      .then(([d, w]) => { setDevice(d); setWindows(w); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deviceId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-1 rounded-lg bg-muted p-1 border border-border w-fit">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-24 rounded-md" />)}
        </div>
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => <WindowSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/30 p-6 text-red-400">
        {error ?? "Device not found"}
      </div>
    );
  }

  return (
    <div>
      {/* Back */}
      <Link href="/dashboard/devices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <ArrowLeft className="h-4 w-4" /> Back to devices
      </Link>

      {/* Device header */}
      <div
        className="mb-6 flex items-center justify-between"
        style={{ viewTransitionName: `device-${deviceId}` }}
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">{device.label || "Unnamed Device"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{device.location || device.device_id}</p>
        </div>
        <span className={`text-sm font-medium capitalize ${device.status === "online" || device.status === "streaming" ? "text-primary" : device.status === "offline" ? "text-red-400" : "text-muted-foreground"}`}>
          {device.status}
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1 border border-border w-fit">
        {([["listen", "Listen Live"], ["recent", "Recent"], ["report", "Report"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "listen" && (
          <motion.div key="listen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
              {/* Waveform */}
              <div className="h-32">
                <Waveform playing={playing} />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      device.status === "streaming"
                        ? "bg-blue-500 animate-pulse"
                        : device.status === "online"
                          ? "bg-emerald-500"
                          : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {device.status === "online" || device.status === "streaming"
                      ? playing ? "Streaming" : "Ready"
                      : "Device offline"}
                  </span>
                </div>

                <button
                  onClick={() => setPlaying(!playing)}
                  disabled={device.status === "offline"}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "recent" && (
          <motion.div key="recent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {windows.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-6 w-6" />
                <p className="text-sm">No analysis windows yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {windows.map((w) => (
                  <button
                    key={w.window_id}
                    onClick={() => setSelectedWindow(w)}
                    className="w-full rounded-xl border border-border bg-card/50 p-4 text-left hover:border-muted-foreground/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(w.started_at).toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{w.duration_minutes}m · {w.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {w.highlights.length > 0 && (
                          <BadgeVariant variant="emerald">
                            {w.highlights.length} highlights
                          </BadgeVariant>
                        )}
                        {w.flags_count > 0 && (
                          <BadgeVariant variant="amber" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {w.flags_count}
                          </BadgeVariant>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "report" && (
          <motion.div key="report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {selectedWindow ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card/50 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Window Report</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {new Date(selectedWindow.started_at).toLocaleString()} · {selectedWindow.duration_minutes}m
                  </p>
                  {selectedWindow.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedWindow.summary}</p>
                  )}
                </div>
                {selectedWindow.highlights.length > 0 && (
                  <div className="rounded-xl border border-border bg-card/50 p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Highlights</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedWindow.highlights.map((h, i) => (
                        <BadgeVariant key={i} variant="emerald">
                          {h}
                        </BadgeVariant>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-6 w-6" />
                <p className="text-sm">Select a window from the Recent tab to view its report</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
