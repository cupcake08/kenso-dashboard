"use client";
import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, AlertTriangle, FileText, Loader2, Volume2, VolumeX } from "lucide-react";
import { apiFetch, normalizeAnalysisRun, normalizeAnalysisRunDetail, normalizeDevice } from "@/lib/api";
import type {
  AnalysisRunDetail,
  AnalysisRunSummary,
  Device,
  RawAnalysisRunDetail,
  RawAnalysisRunSummary,
  RawDevice,
} from "@/types/api";
import { useApi } from "@/hooks/use-api";
import { Play, Pause } from "lucide-react";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Skeleton, WindowSkeleton } from "@/components/ui/skeleton";
import { Waveform } from "@/components/ui/waveform";
import { useListenLive } from "@/hooks/use-listen";
import { useListenIdle } from "@/hooks/use-listen-idle";
import { LiveListenIdlePrompt } from "@/components/dashboard/live-listen-idle-prompt";
import { RecordingsPlayer } from "@/components/dashboard/recordings-player";
import { Button } from "@/components/ui/button";

type Tab = "listen" | "recordings" | "recent" | "report";

const DEMO_DEVICE: Device = {
  device_id: "dev_001_koramangala",
  shop_id: "shop_001",
  label: "Store - Koramangala",
  location: "Koramangala, Bangalore",
  status: "streaming",
  last_seen_at: new Date().toISOString(),
};
const DEMO_RUNS: AnalysisRunSummary[] = [
  { run_id: "run_001", started_at: new Date(Date.now() - 3600000).toISOString(), duration_minutes: 30, status: "ready", finding_count: 1 },
  { run_id: "run_002", started_at: new Date(Date.now() - 5400000).toISOString(), duration_minutes: 30, status: "ready", finding_count: 0 },
  { run_id: "run_003", started_at: new Date(Date.now() - 10800000).toISOString(), duration_minutes: 30, status: "ready", finding_count: 2 },
];

function RunStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: "bg-status-online/10 text-status-online",
    analyzing: "bg-status-streaming/10 text-status-streaming",
    pending: "bg-status-pending/10 text-status-pending",
    failed: "bg-status-offline/10 text-status-offline",
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

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedRun, setSelectedRun] = useState<AnalysisRunSummary | null>(null);

  // SWR: device detail
  const { data: device = null, isLoading: deviceLoading, error: deviceError } = useApi<Device | null>(
    isDemoMode ? null : `/devices/${deviceId}`,
    async (url) => normalizeDevice(await apiFetch<RawDevice>(url)),
    { fallbackData: isDemoMode ? DEMO_DEVICE : null },
  );

  // SWR: analysis runs
  const { data: runs = [], isLoading: runsLoading } = useApi<AnalysisRunSummary[]>(
    isDemoMode ? null : `/devices/${deviceId}/analysis-runs`,
    async (url) => (await apiFetch<RawAnalysisRunSummary[]>(url)).map(normalizeAnalysisRun),
    { fallbackData: isDemoMode ? DEMO_RUNS : undefined },
  );

  const loading = deviceLoading || runsLoading;
  const error = deviceError?.message ?? "";

  // SWR: analysis run detail (conditional — only when a run is selected)
  const { data: runDetail = null, isLoading: detailLoading } = useApi<AnalysisRunDetail | null>(
    !isDemoMode && selectedRun ? `/devices/${deviceId}/analysis-runs/${selectedRun.run_id}` : null,
    async (url) => normalizeAnalysisRunDetail(await apiFetch<RawAnalysisRunDetail>(url)),
    {
      fallbackData: isDemoMode && selectedRun ? {
        run_id: selectedRun.run_id,
        started_at: selectedRun.started_at,
        duration_minutes: selectedRun.duration_minutes,
        status: selectedRun.status,
        summary: "Busy morning with good customer flow. Payment activity normal. One policy deviation flagged during the second half of the window.",
        highlights: [
          { type: "payment", time: "10:15 AM", description: "Payment received via UPI — \u20B9450" },
          { type: "inquiry", time: "10:22 AM", description: "Customer asked about pricing for bulk orders" },
          { type: "action", time: "10:35 AM", description: "Staff arranged delivery for Thursday" },
        ],
        findings: selectedRun.finding_count > 0 ? [
          { finding_type: "policy_violation", title: "Policy Deviation", description: "Staff did not issue receipt for cash payment", severity: "warning" as const },
        ] : [],
        utterances: [
          { speaker: "SPEAKER_01", text: "How much for 5 packets?", absolute_time: "10:22 AM" },
          { speaker: "SPEAKER_02", text: "\u20B9450 total, I can give you a discount if you take 10.", absolute_time: "10:23 AM" },
        ],
      } : null,
    },
  );

  const { audioRef, state: listenState, audioLevel, frequencyDataRef, volume, setVolume, toggle: toggleListen, clientRef } = useListenLive(
    deviceId,
    device?.shop_id ?? ""
  );

  const isListenConnected = listenState === "connected" || listenState === "connecting";
  const { state: idleState, acknowledge: acknowledgeIdle, dismiss: dismissIdle } = useListenIdle(clientRef, isListenConnected);

  function selectRunAndSwitch(run: AnalysisRunSummary) {
    setSelectedRun(run);
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
      <div role="alert" className="rounded-xl border border-red-900 bg-red-950/30 p-6 text-red-400">
        {error ?? "Device not found"}
      </div>
    );
  }

  return (
    <div>
      {/* Hidden audio element for WebRTC playback — must be in DOM for autoplay policy */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
      {/* Back */}
      <Link href="/dashboard/devices" className="mb-3 sm:mb-4 -ml-1 inline-flex items-center gap-1.5 px-1 py-1 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <ArrowLeft className="h-4 w-4" /> Back to devices
      </Link>

      {/* Device header — stacks on mobile */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{device.label || "Unnamed Device"}</h1>
          <p className="mt-0.5 sm:mt-1 text-sm text-muted-foreground truncate">{device.location || device.device_id}</p>
        </div>
        <span className={`text-sm font-medium capitalize self-start sm:self-auto shrink-0 ${device.status === "online" || device.status === "streaming" ? "text-status-online" : device.status === "offline" ? "text-status-offline" : device.status === "pending" ? "text-status-pending" : "text-muted-foreground"}`}>
          {device.status}
        </span>
      </div>

      {/* Tabs — full-width equal tabs on mobile, shrink-wrap on desktop */}
      <div role="tablist" aria-label="Device sections" className="mb-4 sm:mb-6 flex gap-1 rounded-lg bg-muted p-1 border border-border sm:w-fit">
        {([["listen", "Listen Live"], ["recordings", "Recordings"], ["recent", "Recent"], ["report", "Report"]] as const).map(([t, label]) => {
          const isDisabled = t === "listen" && device.status === "offline";
          return (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            disabled={isDisabled}
            aria-disabled={isDisabled || undefined}
            title={isDisabled ? "Device is offline" : undefined}
            onClick={() => setTab(t)}
            className={`flex-1 sm:flex-initial px-2 sm:px-4 py-2 sm:py-2.5 rounded-md text-xs sm:text-sm font-medium text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              isDisabled ? "text-muted-foreground/40 cursor-not-allowed" :
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === "listen" && (
          <motion.div key="listen" role="tabpanel" id="panel-listen" aria-labelledby="listen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
              {idleState.promptActive && idleState.countdownSeconds !== null ? (
                <LiveListenIdlePrompt
                  countdownSeconds={idleState.countdownSeconds}
                  onAcknowledge={acknowledgeIdle}
                  onDismiss={dismissIdle}
                />
              ) : idleState.idleClosedReason !== null ? (
                <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {idleState.idleClosedReason === "hidden_too_long"
                      ? "Stream closed — you were away from this tab"
                      : "Stream closed — no activity detected"}
                  </p>
                  <Button onClick={toggleListen}>Start listening again</Button>
                </div>
              ) : (
                <>
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
                        ? "bg-status-online animate-pulse"
                        : listenState === "connecting"
                          ? "bg-status-pending animate-pulse"
                          : listenState === "error"
                            ? "bg-status-offline"
                            : device.status === "offline"
                              ? "bg-status-offline/60"
                              : "bg-muted-foreground/40"
                    }`}
                  />
                  <span className={`text-sm ${
                    listenState === "connected" ? "text-status-online font-medium" :
                    listenState === "error" ? "text-status-offline" :
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
                        ? "bg-status-offline/90 text-white hover:bg-status-offline"
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
                </>
              )}
            </div>
          </motion.div>
        )}

        {tab === "recordings" && (
          <motion.div key="recordings" role="tabpanel" id="panel-recordings" aria-labelledby="recordings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <RecordingsPlayer deviceId={deviceId} />
          </motion.div>
        )}

        {tab === "recent" && (
          <motion.div key="recent" role="tabpanel" id="panel-recent" aria-labelledby="recent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {runs.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-6 w-6" />
                <p className="text-sm">No analysis runs yet</p>
                <p className="text-xs">Runs appear here after you analyze audio for this device</p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <button
                    key={run.run_id}
                    onClick={() => selectRunAndSwitch(run)}
                    className={`w-full rounded-xl border bg-card/50 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selectedRun?.run_id === run.run_id
                        ? "border-primary/50 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {new Date(run.started_at).toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{run.duration_minutes}m run</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RunStatusBadge status={run.status} />
                        {run.finding_count > 0 && (
                          <BadgeVariant variant="amber" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {run.finding_count}
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
          <motion.div key="report" role="tabpanel" id="panel-report" aria-labelledby="report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {selectedRun ? (
              <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                {/* Run header */}
                <div className="px-3 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-foreground">Analysis Report</h3>
                    <RunStatusBadge status={selectedRun.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedRun.started_at).toLocaleString()} · {selectedRun.duration_minutes}m
                  </p>
                </div>

                {detailLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm">Loading report…</p>
                  </div>
                ) : runDetail ? (
                  <div className="divide-y divide-border/50">
                    {/* Summary */}
                    {runDetail.summary && (
                      <div className="px-3 sm:px-5 py-3 sm:py-4">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Summary</h4>
                        <p className="text-sm text-foreground leading-relaxed">{runDetail.summary}</p>
                      </div>
                    )}

                    {/* Highlights — stacks on mobile */}
                    {runDetail.highlights.length > 0 && (
                      <div className="px-3 sm:px-5 py-3 sm:py-4">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Highlights</h4>
                        <div className="space-y-3 sm:space-y-2">
                          {runDetail.highlights.map((h, i) => (
                            <div key={i} className="text-sm">
                              <div className="flex items-center gap-2 mb-0.5 sm:mb-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{h.time}</span>
                                <BadgeVariant variant="emerald">{h.type}</BadgeVariant>
                              </div>
                              <p className="text-foreground sm:ml-0 mt-0.5 sm:mt-0 sm:inline">{h.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Findings */}
                    {runDetail.findings.length > 0 && (
                      <div className="px-3 sm:px-5 py-3 sm:py-4">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Findings</h4>
                        <div className="space-y-2">
                          {runDetail.findings.map((finding, i) => (
                            <div key={i} className={`rounded-lg border p-3 text-sm ${
                              finding.severity === "critical" ? "border-status-offline/30 bg-status-offline/5 text-status-offline" :
                              finding.severity === "warning" ? "border-status-pending/30 bg-status-pending/5 text-status-pending" :
                              "border-border bg-card/50 text-muted-foreground"
                            }`}>
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                <p className="font-medium">{finding.title}</p>
                              </div>
                              {finding.description && <p className="mt-1 ml-5.5 text-xs opacity-80">{finding.description}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Utterances — stacks speaker above text on mobile */}
                    {runDetail.utterances.length > 0 && (
                      <div className="px-3 sm:px-5 py-3 sm:py-4">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Transcript</h4>
                        <div className="space-y-2.5 sm:space-y-2">
                          {runDetail.utterances.map((u, i) => (
                            <div key={i} className="text-sm">
                              <span className="text-xs font-medium text-primary whitespace-nowrap">{u.speaker}</span>
                              <p className="text-foreground mt-0.5 sm:mt-0 sm:inline sm:ml-3">{u.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No content fallback */}
                    {!runDetail.summary && runDetail.highlights.length === 0 && runDetail.findings.length === 0 && runDetail.utterances.length === 0 && (
                      <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <FileText className="h-6 w-6" />
                        <p className="text-sm">No report data available yet</p>
                      </div>
                    )}
                  </div>
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
                <p className="text-sm">Select an analysis run from the Recent tab to view its report</p>
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
