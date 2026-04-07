"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mic, Clock, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Device, WindowSummary } from "@/types/api";
import { Loader2, Play, Pause, Volume2 } from "lucide-react";

type Tab = "listen" | "recent" | "report";

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
    Promise.all([
      apiFetch<{ device: Device }>(`/devices/${deviceId}`).then(({ device }) => device),
      apiFetch<{ windows: WindowSummary[] }>(`/devices/${deviceId}/windows`).then(({ windows }) => windows),
    ])
      .then(([d, w]) => { setDevice(d); setWindows(w); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deviceId]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
    </div>;
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
      <Link href="/dashboard/devices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-50 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to devices
      </Link>

      {/* Device header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">{device.label || "Unnamed Device"}</h1>
          <p className="mt-1 text-sm text-slate-500">{device.location || device.device_id}</p>
        </div>
        <span className={`text-sm font-medium capitalize ${device.status === "online" ? "text-emerald-400" : "text-red-400"}`}>
          {device.status}
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800 w-fit">
        {([["listen", "Listen Live"], ["recent", "Recent"], ["report", "Report"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "listen" && (
          <motion.div key="listen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 flex flex-col items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-950/50 border border-emerald-800">
                <Mic className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-slate-50 font-medium">{device.label || "Live Audio"}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {device.status === "online" || device.status === "streaming"
                    ? "Device is online — tap to start listening"
                    : "Device is offline"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setPlaying(!playing)}
                  disabled={device.status === "offline"}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </button>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-slate-500" />
                  <input type="range" min="0" max="100" defaultValue="80" className="w-24 accent-emerald-500" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "recent" && (
          <motion.div key="recent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {windows.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500">
                <Clock className="h-6 w-6" />
                <p className="text-sm">No analysis windows yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {windows.map((w) => (
                  <button
                    key={w.window_id}
                    onClick={() => setSelectedWindow(w)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-50">
                          {new Date(w.started_at).toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{w.duration_minutes}m · {w.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {w.highlights.length > 0 && (
                          <span className="rounded-full bg-emerald-950/50 border border-emerald-800 px-2 py-0.5 text-xs text-emerald-400">
                            {w.highlights.length} highlights
                          </span>
                        )}
                        {w.flags_count > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-950/50 border border-amber-800 px-2 py-0.5 text-xs text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            {w.flags_count}
                          </span>
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
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                  <h3 className="text-sm font-semibold text-slate-50 mb-3">Window Report</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {new Date(selectedWindow.started_at).toLocaleString()} · {selectedWindow.duration_minutes}m
                  </p>
                  {selectedWindow.summary && (
                    <p className="text-sm text-slate-300 leading-relaxed">{selectedWindow.summary}</p>
                  )}
                </div>
                {selectedWindow.highlights.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                    <h3 className="text-sm font-semibold text-slate-50 mb-3">Highlights</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedWindow.highlights.map((h, i) => (
                        <span key={i} className="rounded-full bg-emerald-950/50 border border-emerald-800 px-3 py-1 text-xs text-emerald-400">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500">
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
