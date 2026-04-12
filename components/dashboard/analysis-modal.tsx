"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Shield, Users, TrendingUp, Zap, Loader2, CheckCircle2, X, Check, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch, estimateCredits, createJob, normalizeDevice } from "@/lib/api";
import type { AnalysisTemplate, AnalysisJob, EstimateResult } from "@/types/analysis";
import type { Device, RawDevice } from "@/types/api";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  staff_performance: Users,
  customer_interaction: BarChart3,
  sales_revenue: TrendingUp,
  compliance_policy: Shield,
};

const STEPS = ["Template", "Devices", "Time Range", "Notes", "Confirm"] as const;

/* ── Time presets ── */

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TIME_PRESETS = [
  { label: "Last 2 hours", hours: 2 },
  { label: "Last 4 hours", hours: 4 },
  { label: "Last 8 hours", hours: 8 },
] as const;

const DAY_PRESETS = [
  { label: "Today", daysAgo: 0 },
  { label: "Yesterday", daysAgo: 1 },
] as const;

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    const hh = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    TIME_OPTIONS.push(`${hh}:${m.toString().padStart(2, "0")} ${ampm}`);
  }
}

function parseTimeOption(timeStr: string, baseDate: Date): Date {
  const [time, ampm] = timeStr.split(" ");
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr);
  const m = parseInt(mStr);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTimeDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── TimeRangeStep ── */

function TimeRangeStep({ rangeStart, rangeEnd, onRangeChange, onBack, onNext }: {
  rangeStart: string;
  rangeEnd: string;
  onRangeChange: (start: string, end: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [mode, setMode] = useState<"presets" | "custom">(rangeStart ? "custom" : "presets");
  const [selectedDay, setSelectedDay] = useState(0); // 0 = today, 1 = yesterday
  const [startTime, setStartTime] = useState("9:00 AM");
  const [endTime, setEndTime] = useState("6:00 PM");

  const applyPreset = (hours: number) => {
    const now = new Date();
    const start = new Date(now.getTime() - hours * 3600000);
    onRangeChange(toLocalDatetimeString(start), toLocalDatetimeString(now));
  };

  const applyDayPreset = (daysAgo: number) => {
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    day.setHours(0, 0, 0, 0);
    const end = new Date(day);
    if (daysAgo === 0) {
      end.setTime(Date.now()); // today → up to now
    } else {
      end.setHours(23, 59, 59, 0);
    }
    onRangeChange(toLocalDatetimeString(day), toLocalDatetimeString(end));
  };

  const applyCustom = () => {
    const base = new Date();
    base.setDate(base.getDate() - selectedDay);
    const start = parseTimeOption(startTime, base);
    const end = parseTimeOption(endTime, base);
    // If end is before start, the range crosses midnight — roll end to next day
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    onRangeChange(toLocalDatetimeString(start), toLocalDatetimeString(end));
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["presets", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "presets" ? "Quick Select" : "Custom Range"}
          </button>
        ))}
      </div>

      {mode === "presets" ? (
        <div className="space-y-2">
          {/* Time presets */}
          <p className="text-xs text-muted-foreground">Recent</p>
          <div className="grid grid-cols-3 gap-2">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.hours}
                type="button"
                onClick={() => applyPreset(p.hours)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                  rangeStart && Math.abs(new Date(rangeEnd).getTime() - new Date(rangeStart).getTime() - p.hours * 3600000) < 60000
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Day presets */}
          <p className="text-xs text-muted-foreground mt-3">Full day</p>
          <div className="grid grid-cols-2 gap-2">
            {DAY_PRESETS.map((p) => (
              <button
                key={p.daysAgo}
                type="button"
                onClick={() => applyDayPreset(p.daysAgo)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                  rangeStart && (() => {
                    const s = new Date(rangeStart);
                    const ref = new Date();
                    ref.setDate(ref.getDate() - p.daysAgo);
                    return s.toDateString() === ref.toDateString() && s.getHours() === 0;
                  })()
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Day selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Day</p>
            <div className="flex gap-2">
              {DAY_PRESETS.map((p) => (
                <button
                  key={p.daysAgo}
                  type="button"
                  onClick={() => { setSelectedDay(p.daysAgo); }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    selectedDay === p.daysAgo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">From</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none cursor-pointer"
              >
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">To</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none cursor-pointer"
              >
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={applyCustom}>
            Apply
          </Button>
        </div>
      )}

      {/* Selected range display */}
      {rangeStart && rangeEnd && (
        <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {formatTimeDisplay(rangeStart)} → {formatTimeDisplay(rangeEnd)}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onBack}>Back</Button>
        <Button className="flex-1" onClick={onNext} disabled={!rangeStart || !rangeEnd}>Next</Button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onJobCreated: (job: AnalysisJob) => void;
  templates: AnalysisTemplate[];
  initialTemplate?: AnalysisTemplate | null;
  initialStep?: number;
}

export function AnalysisModal({ open, onClose, onJobCreated, templates, initialTemplate, initialStep }: Props) {
  const [step, setStep] = useState(initialStep ?? 0);
  const [selectedTemplate, setSelectedTemplate] = useState<AnalysisTemplate | null>(initialTemplate ?? null);
  const [selectedMics, setSelectedMics] = useState<string[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset on open + fetch devices
  useEffect(() => {
    if (open) {
      setStep(initialStep ?? (initialTemplate ? 1 : 0));
      setSelectedTemplate(initialTemplate ?? null);
      setSelectedMics([]);
      setRangeStart("");
      setRangeEnd("");
      setNotes("");
      setEstimate(null);
      setSubmitError("");

      // Fetch user's devices for the checkbox list
      if (devices.length === 0) {
        setDevicesLoading(true);
        if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
          setDevices([
            { device_id: "mic_lobby_01", shop_id: "shop_001", label: "Lobby Mic", location: "", status: "online", last_seen_at: "" },
            { device_id: "mic_counter_02", shop_id: "shop_001", label: "Counter Mic", location: "", status: "online", last_seen_at: "" },
            { device_id: "mic_back_03", shop_id: "shop_001", label: "Back Office", location: "", status: "offline", last_seen_at: "" },
          ]);
          setDevicesLoading(false);
        } else {
          apiFetch<RawDevice[]>("/devices")
            .then((raw) => setDevices((raw ?? []).map(normalizeDevice)))
            .catch(() => {})
            .finally(() => setDevicesLoading(false));
        }
      }
    }
  }, [open, initialTemplate, initialStep, devices.length]);

  // Focus trap + ESC
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    // Auto-focus first focusable
    requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>("button, input, textarea");
      first?.focus();
    });
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, step, onClose]);

  const runEstimate = useCallback(async () => {
    if (!selectedTemplate || selectedMics.length === 0 || !rangeStart || !rangeEnd) return;
    setEstimating(true);
    setSubmitError("");
    try {
      if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
        await new Promise((r) => setTimeout(r, 600));
        const durMin = (new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / 60000;
        setEstimate({
          estimatedCredits: Math.round(durMin * selectedMics.length * (selectedTemplate.complexityMultiplier ?? 1) * 10) / 10,
          estimatedDurationMin: durMin,
          totalAudioDurationMs: durMin * 60000,
          hasAudio: true,
        });
        setStep(4);
        return;
      }
      const est = await estimateCredits({
        template_id: selectedTemplate.templateId,
        mic_ids: selectedMics,
        shop_ids: [],
        time_range_start_unix: Math.floor(new Date(rangeStart).getTime() / 1000),
        time_range_end_unix: Math.floor(new Date(rangeEnd).getTime() / 1000),
      });
      setEstimate(est);
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Estimate failed");
    } finally {
      setEstimating(false);
    }
  }, [selectedTemplate, selectedMics, rangeStart, rangeEnd]);

  const submitJob = useCallback(async () => {
    if (!selectedTemplate || selectedMics.length === 0 || !rangeStart || !rangeEnd) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
        await new Promise((r) => setTimeout(r, 800));
        const demoJob: AnalysisJob = {
          jobId: `job_demo_${Date.now()}`, companyId: "demo", templateId: selectedTemplate.templateId,
          templateName: selectedTemplate.name, micIds: selectedMics,
          timeRangeStart: new Date(rangeStart).toISOString(), timeRangeEnd: new Date(rangeEnd).toISOString(),
          status: "processing", executionTier: "flex", estimatedCredits: estimate?.estimatedCredits ?? 100,
          actualCredits: 0, chunkCount: 4, chunksCompleted: 0, cached: false, createdAt: new Date().toISOString(),
        };
        onJobCreated(demoJob);
        onClose();
        return;
      }
      const job = await createJob({
        template_id: selectedTemplate.templateId,
        mic_ids: selectedMics,
        shop_ids: [],
        time_range_start_unix: Math.floor(new Date(rangeStart).getTime() / 1000),
        time_range_end_unix: Math.floor(new Date(rangeEnd).getTime() / 1000),
        free_text_notes: notes || undefined,
      });
      onJobCreated(job);
      onClose();
      toast.success("Analysis started — we'll notify you when it's ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create job";
      if (msg.includes("insufficient credits")) {
        toast.error("Not enough credits. Top up to run analysis.");
      }
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [selectedTemplate, selectedMics, rangeStart, rangeEnd, notes, estimate, onJobCreated, onClose]);

  function costLabel(multiplier: number): string {
    if (multiplier <= 1) return "Standard";
    if (multiplier <= 1.3) return "Standard+";
    return "Premium";
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
          role="presentation"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label="New Analysis"
            className="bg-background rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-lg sm:mx-4 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header with step indicator */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">New Analysis</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Step {step + 1} of {STEPS.length} &middot; {STEPS[step]}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step dots */}
            <div className="flex gap-1.5 mb-5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>

            {/* Step 0: Template selection */}
            {step === 0 && (
              <div className="space-y-2">
                {templates.map((t) => {
                  const Icon = CATEGORY_ICONS[t.category] ?? BarChart3;
                  return (
                    <button
                      key={t.templateId}
                      onClick={() => { setSelectedTemplate(t); setStep(1); }}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Icon className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{costLabel(t.complexityMultiplier)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 1: Device selection */}
            {step === 1 && selectedTemplate && (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Using <span className="text-foreground font-medium">{selectedTemplate.name}</span>
                </p>

                {devicesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : devices.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-6 text-center">
                    <Cpu className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No devices found</p>
                  </div>
                ) : (
                  <>
                    {/* Select all */}
                    <button
                      onClick={() => {
                        if (selectedMics.length === devices.length) {
                          setSelectedMics([]);
                        } else {
                          setSelectedMics(devices.map((d) => d.device_id));
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border hover:bg-muted/20 transition-colors text-left mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                        selectedMics.length === devices.length
                          ? "bg-primary border-primary text-primary-foreground"
                          : selectedMics.length > 0
                            ? "bg-primary/30 border-primary/50 text-primary-foreground"
                            : "border-muted-foreground/30"
                      }`}>
                        {selectedMics.length > 0 && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {selectedMics.length === devices.length ? "Deselect all" : "Select all devices"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {selectedMics.length}/{devices.length}
                      </span>
                    </button>

                    {/* Device list */}
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {devices.map((device) => {
                        const isSelected = selectedMics.includes(device.device_id);
                        return (
                          <button
                            key={device.device_id}
                            onClick={() => {
                              setSelectedMics((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== device.device_id)
                                  : [...prev, device.device_id]
                              );
                            }}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                            }`}
                          >
                            <div className={`flex h-5 w-5 items-center justify-center rounded border shrink-0 transition-colors ${
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            }`}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground truncate">{device.label || device.device_id}</p>
                            </div>
                            <span className={`h-2 w-2 rounded-full shrink-0 ${
                              device.status === "online" || device.status === "streaming"
                                ? "bg-emerald-500"
                                : device.status === "pending"
                                  ? "bg-amber-400"
                                  : "bg-muted-foreground/30"
                            }`} />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                  <Button className="flex-1" onClick={() => setStep(2)} disabled={selectedMics.length === 0}>
                    Next ({selectedMics.length} selected)
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Time range — presets + custom */}
            {step === 2 && (
              <TimeRangeStep
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onRangeChange={(start, end) => { setRangeStart(start); setRangeEnd(end); }}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}

            {/* Step 3: Notes */}
            {step === 3 && (
              <div>
                <label htmlFor="analysis-notes" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Focus notes (optional)
                </label>
                <textarea
                  id="analysis-notes"
                  className="w-full h-28 rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm text-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. Focus on customer complaints around 10am"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                  <Button className="flex-1" onClick={runEstimate} disabled={estimating}>
                    {estimating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Estimate Cost
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === 4 && estimate && (
              <div>
                {!estimate.hasAudio ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
                    <p className="text-sm text-amber-400">No audio found in this time range.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Template</span>
                      <span className="text-foreground font-medium">{selectedTemplate?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Audio</span>
                      <span className="text-foreground tabular-nums">{estimate.estimatedDurationMin.toFixed(0)} min</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Devices</span>
                      <span className="text-foreground tabular-nums">{selectedMics.length}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-foreground">Estimated cost</span>
                      <span className="text-primary text-lg tabular-nums">{estimate.estimatedCredits} credits</span>
                    </div>
                  </div>
                )}
                {submitError && (
                  <p className="text-sm text-red-400 mb-3" role="alert">{submitError}</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Back</Button>
                  <Button className="flex-1" onClick={submitJob} disabled={!estimate.hasAudio || submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Run Analysis
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
