"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { apiFetch, normalizeDevice, normalizeWindow } from "@/lib/api";
import type { Device, WindowSummary, WindowDetail, RawDevice, RawWindowSummary, RawWindowDetail } from "@/types/api";
import { normalizeWindowDetail } from "@/lib/api";
import { Play, Pause } from "lucide-react";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Skeleton, WindowSkeleton } from "@/components/ui/skeleton";
import { Waveform } from "@/components/ui/waveform";
import { useListenLive } from "@/hooks/use-listen";

type Tab = "listen" | "recent" | "report";

const DEMO_DEVICE: Device = {
  device_id: "dev_001_koramangala",
  label: "Store - Koramangala",
  location: "Koramangala, Bangalore",
  status: "streaming",
  last_seen_at: new Date().toISOString(),
};
const DEMO_WINDOWS: WindowSummary[] = [
  { window_id: "win_001", started_at: new Date(Date.now() - 3600000).toISOString(), duration_minutes: 30, status: "ready", flag_count: 1 },
  { window_id: "win_002", started_at: new Date(Date.now() - 5400000).toISOString(), duration_minutes: 30, status: "ready", flag_count: 0 },
  { window_id: "win_003", started_at: new Date(Date.now() - 10800000).toISOString(), duration_minutes: 30, status: "ready", flag_count: 2 },
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
  const [windowDetail, setWindowDetail] = useState<WindowDetail | null>(null);
  const { state: listenState, audioLevel, toggle: toggleListen } = useListenLive(deviceId);

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
      apiFetch<RawDevice>(`/devices/${deviceId}`).then(normalizeDevice),
      apiFetch<RawWindowSummary[]>(`/devices/${deviceId}/windows`).then((raw) => raw.map(normalizeWindow)),
    ])
      .then(([d, w]) => { setDevice(d); setWindows(w); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deviceId]);

  // Fetch window detail when a window is selected
  useEffect(() => {
    if (!selectedWindow || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      if (selectedWindow && process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
        // Demo detail
        setWindowDetail({
          window_id: selectedWindow.window_id,
          started_at: selectedWindow.started_at,
          duration_minutes: selectedWindow.duration_minutes,
          summary: "Busy morning with good customer flow. Payment activity normal.",
          highlights: [
            { type: "payment", time: "10:15 AM", description: "Payment received via UPI" },
            { type: "inquiry", time: "10:22 AM", description: "Customer asked about pricing" },
          ],
          flags: selectedWindow.flag_count > 0 ? [
            { flag_type: "policy_violation", title: "Policy Deviation", severity: "warning" as const },
          ] : [],
          utterances: [],
        });
      }
      return;
    }
    setWindowDetail(null);
    apiFetch<RawWindowDetail>(`/devices/${deviceId}/windows/${selectedWindow.window_id}`)
      .then(normalizeWindowDetail)
      .then(setWindowDetail)
      .catch(() => setWindowDetail(null));
  }, [selectedWindow, deviceId]);

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
                <Waveform playing={listenState === "connected"} audioLevel={audioLevel} />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      listenState === "connected"
                        ? "bg-emerald-500 animate-pulse"
                        : listenState === "connecting"
                          ? "bg-blue-500 animate-pulse"
                          : device.status === "offline"
                            ? "bg-red-500"
                            : "bg-muted-foreground"
                    }`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {listenState === "connected"
                      ? "Live"
                      : listenState === "connecting"
                        ? "Connecting…"
                        : listenState === "error"
                          ? "Connection failed"
                          : device.status === "offline"
                            ? "Device offline"
                            : "Ready"
                    }
                  </span>
                </div>

                <button
                  onClick={toggleListen}
                  disabled={device.status === "offline" && listenState === "idle"}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={listenState === "connected" || listenState === "connecting" ? "Stop" : "Play"}
                >
                  {listenState === "connected" || listenState === "connecting"
                    ? <Pause className="h-4 w-4" />
                    : <Play className="h-4 w-4 ml-0.5" />
                  }
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
                        {w.flag_count > 0 && (
                          <BadgeVariant variant="amber" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {w.flag_count}
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
                  {windowDetail ? (
                    <>
                      {windowDetail.summary && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{windowDetail.summary}</p>
                      )}
                      {windowDetail.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {windowDetail.highlights.map((h, i) => (
                            <BadgeVariant key={i} variant="emerald">
                              {h.description}
                            </BadgeVariant>
                          ))}
                        </div>
                      )}
                      {windowDetail.flags.length > 0 && (
                        <div className="space-y-2">
                          {windowDetail.flags.map((f, i) => (
                            <div key={i} className={`rounded-lg border p-3 text-sm ${
                              f.severity === "critical" ? "border-red-900 bg-red-950/30 text-red-400" :
                              f.severity === "warning" ? "border-amber-900 bg-amber-950/30 text-amber-400" :
                              "border-border bg-card/50 text-muted-foreground"
                            }`}>
                              <p className="font-medium">{f.title}</p>
                              {f.description && <p className="mt-0.5 text-xs opacity-80">{f.description}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading report…</p>
                  )}
                </div>
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
