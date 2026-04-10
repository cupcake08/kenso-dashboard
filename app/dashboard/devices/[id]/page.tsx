"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, AlertTriangle, FileText, Loader2, Volume2, VolumeX } from "lucide-react";
import { auth } from "@/lib/firebase";
import { apiFetch, normalizeDevice, normalizeWindow } from "@/lib/api";
import type { Device, WindowSummary, WindowDetail, RawDevice, RawWindowSummary, RawWindowDetail } from "@/types/api";
import { normalizeWindowDetail } from "@/lib/api";
import { Play, Pause } from "lucide-react";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Skeleton, WindowSkeleton } from "@/components/ui/skeleton";
import { Waveform } from "@/components/ui/waveform";
import { useListenLive } from "@/hooks/use-listen";
import { RecordingsPlayer } from "@/components/dashboard/recordings-player";

type Tab = "listen" | "recordings" | "recent" | "report";

const DEMO_DEVICE: Device = {
  device_id: "dev_001_koramangala",
  shop_id: "shop_001",
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

function WindowStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: "bg-emerald-500/10 text-emerald-500",
    analyzing: "bg-blue-500/10 text-blue-500",
    transcribed: "bg-blue-500/10 text-blue-500",
    pending: "bg-muted text-muted-foreground",
    failed: "bg-red-500/10 text-red-400",
    expired: "bg-muted text-muted-foreground line-through",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

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
  const [detailLoading, setDetailLoading] = useState(false);
  const { audioRef, state: listenState, audioLevel, frequencyDataRef, volume, setVolume, toggle: toggleListen } = useListenLive(
    deviceId,
    device?.shop_id ?? ""
  );

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
    if (!selectedWindow) {
      setWindowDetail(null);
      return;
    }
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      setWindowDetail({
        window_id: selectedWindow.window_id,
        started_at: selectedWindow.started_at,
        duration_minutes: selectedWindow.duration_minutes,
        summary: "Busy morning with good customer flow. Payment activity normal. One policy deviation flagged during the second half of the window.",
        highlights: [
          { type: "payment", time: "10:15 AM", description: "Payment received via UPI — ₹450" },
          { type: "inquiry", time: "10:22 AM", description: "Customer asked about pricing for bulk orders" },
          { type: "action", time: "10:35 AM", description: "Staff arranged delivery for Thursday" },
        ],
        flags: selectedWindow.flag_count > 0 ? [
          { flag_type: "policy_violation", title: "Policy Deviation", description: "Staff did not issue receipt for cash payment", severity: "warning" as const },
        ] : [],
        utterances: [
          { speaker: "SPEAKER_01", text: "How much for 5 packets?", absolute_time: "10:22 AM" },
          { speaker: "SPEAKER_02", text: "₹450 total, I can give you a discount if you take 10.", absolute_time: "10:23 AM" },
        ],
      });
      return;
    }
    setDetailLoading(true);
    setWindowDetail(null);
    apiFetch<RawWindowDetail>(`/devices/${deviceId}/windows/${selectedWindow.window_id}`)
      .then(normalizeWindowDetail)
      .then(setWindowDetail)
      .catch(() => setWindowDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedWindow, deviceId]);

  function selectWindowAndSwitch(w: WindowSummary) {
    setSelectedWindow(w);
    setTab("report");
  }

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
      {/* Hidden audio element for WebRTC playback — must be in DOM for autoplay policy */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
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
        {([["listen", "Listen Live"], ["recordings", "Recordings"], ["recent", "Recent"], ["report", "Report"]] as const).map(([t, label]) => (
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
              <div className="h-28 sm:h-32">
                <Waveform playing={listenState === "connected"} frequencyDataRef={frequencyDataRef} />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-5">
                {/* Status indicator */}
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 transition-colors duration-300 ${
                      listenState === "connected"
                        ? "bg-emerald-500 animate-pulse"
                        : listenState === "connecting"
                          ? "bg-amber-400 animate-pulse"
                          : listenState === "error"
                            ? "bg-red-400"
                            : device.status === "offline"
                              ? "bg-red-500/60"
                              : "bg-muted-foreground/40"
                    }`}
                  />
                  <span className={`text-sm ${
                    listenState === "connected" ? "text-emerald-400 font-medium" :
                    listenState === "error" ? "text-red-400" :
                    "text-muted-foreground"
                  }`}>
                    {listenState === "connected"
                      ? "Live"
                      : listenState === "connecting"
                        ? "Connecting\u2026"
                        : listenState === "error"
                          ? "Failed \u2014 tap to retry"
                          : device.status === "offline"
                            ? "Device offline"
                            : "Tap to listen"
                    }
                  </span>
                </div>

                {/* Volume + Play */}
                <div className="flex items-center gap-2.5">
                  {/* Volume — only visible when connected or connecting */}
                  <AnimatePresence>
                    {(listenState === "connected" || listenState === "connecting") && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-2 overflow-hidden"
                      >
                        <button
                          onClick={() => setVolume(volume === 0 ? 3.0 : 0)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                          aria-label={volume === 0 ? "Unmute" : "Mute"}
                        >
                          {volume === 0
                            ? <VolumeX className="h-4 w-4" />
                            : <Volume2 className="h-4 w-4" />
                          }
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.1"
                          value={volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-20 h-1 accent-primary cursor-pointer rounded-full"
                          aria-label="Volume"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Play/Pause button */}
                  <button
                    onClick={toggleListen}
                    disabled={device.status === "offline" && listenState === "idle"}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 ${
                      listenState === "connected"
                        ? "bg-red-500/90 text-white hover:bg-red-500"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                    aria-label={listenState === "connected" || listenState === "connecting" ? "Stop listening" : "Start listening"}
                  >
                    {listenState === "connecting"
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : listenState === "connected"
                        ? <Pause className="h-4 w-4" />
                        : <Play className="h-4 w-4 ml-0.5" />
                    }
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "recordings" && (
          <motion.div key="recordings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <RecordingsPlayer deviceId={deviceId} />
          </motion.div>
        )}

        {tab === "recent" && (
          <motion.div key="recent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {windows.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-6 w-6" />
                <p className="text-sm">No analysis windows yet</p>
                <p className="text-xs">Windows appear as audio is captured and analyzed</p>
              </div>
            ) : (
              <div className="space-y-2">
                {windows.map((w) => (
                  <button
                    key={w.window_id}
                    onClick={() => selectWindowAndSwitch(w)}
                    className={`w-full rounded-xl border bg-card/50 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selectedWindow?.window_id === w.window_id
                        ? "border-primary/50 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(w.started_at).toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{w.duration_minutes}m window</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <WindowStatusBadge status={w.status} />
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
                {/* Window header */}
                <div className="rounded-xl border border-border bg-card/50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Window Report</h3>
                    <WindowStatusBadge status={selectedWindow.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedWindow.started_at).toLocaleString()} · {selectedWindow.duration_minutes}m
                  </p>
                </div>

                {detailLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm">Loading report…</p>
                  </div>
                ) : windowDetail ? (
                  <>
                    {/* Summary */}
                    {windowDetail.summary && (
                      <div className="rounded-xl border border-border bg-card/50 p-5">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Summary</h4>
                        <p className="text-sm text-foreground leading-relaxed">{windowDetail.summary}</p>
                      </div>
                    )}

                    {/* Highlights */}
                    {windowDetail.highlights.length > 0 && (
                      <div className="rounded-xl border border-border bg-card/50 p-5">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Highlights</h4>
                        <div className="space-y-2">
                          {windowDetail.highlights.map((h, i) => (
                            <div key={i} className="flex items-start gap-3 text-sm">
                              <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">{h.time}</span>
                              <BadgeVariant variant="emerald">{h.type}</BadgeVariant>
                              <span className="text-foreground">{h.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Flags */}
                    {windowDetail.flags.length > 0 && (
                      <div className="rounded-xl border border-border bg-card/50 p-5">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Flags</h4>
                        <div className="space-y-2">
                          {windowDetail.flags.map((f, i) => (
                            <div key={i} className={`rounded-lg border p-3 text-sm ${
                              f.severity === "critical" ? "border-red-900 bg-red-950/30 text-red-400" :
                              f.severity === "warning" ? "border-amber-900 bg-amber-950/30 text-amber-400" :
                              "border-border bg-card/50 text-muted-foreground"
                            }`}>
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                <p className="font-medium">{f.title}</p>
                              </div>
                              {f.description && <p className="mt-1 ml-5.5 text-xs opacity-80">{f.description}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Utterances */}
                    {windowDetail.utterances.length > 0 && (
                      <div className="rounded-xl border border-border bg-card/50 p-5">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Transcript</h4>
                        <div className="space-y-2">
                          {windowDetail.utterances.map((u, i) => (
                            <div key={i} className="flex items-start gap-3 text-sm">
                              <span className="text-xs font-medium text-primary whitespace-nowrap pt-0.5">{u.speaker}</span>
                              <span className="text-foreground">{u.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No content fallback */}
                    {!windowDetail.summary && windowDetail.highlights.length === 0 && windowDetail.flags.length === 0 && windowDetail.utterances.length === 0 && (
                      <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <FileText className="h-6 w-6" />
                        <p className="text-sm">No report data available yet</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <FileText className="h-6 w-6" />
                    <p className="text-sm">No report data available</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileText className="h-6 w-6" />
                <p className="text-sm">Select a window from the Recent tab to view its report</p>
                <button
                  onClick={() => setTab("recent")}
                  className="text-xs text-primary hover:underline"
                >
                  Go to Recent →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
