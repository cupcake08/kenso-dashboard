"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Check, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listTemplates, estimateCredits, apiFetch, normalizeDevice } from "@/lib/api";
import { parseCron } from "@/lib/cron";
import type { AnalysisTemplate, AnalysisSchedule, EstimateResult } from "@/types/analysis";
import type { Device, RawDevice } from "@/types/api";

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_DEVICES: Device[] = [
  { device_id: "mic_lobby_01", shop_id: "shop_001", label: "Lobby Mic", location: "Koramangala", status: "online", last_seen_at: "" },
  { device_id: "mic_counter_02", shop_id: "shop_001", label: "Counter Mic", location: "Koramangala", status: "online", last_seen_at: "" },
  { device_id: "mic_back_03", shop_id: "shop_001", label: "Back Office", location: "Koramangala", status: "offline", last_seen_at: "" },
  { device_id: "mic_floor_01", shop_id: "shop_002", label: "Floor Mic", location: "Indiranagar", status: "online", last_seen_at: "" },
  { device_id: "mic_entry_01", shop_id: "shop_002", label: "Entry Gate", location: "Indiranagar", status: "online", last_seen_at: "" },
];

const DEMO_TEMPLATES: AnalysisTemplate[] = [
  { templateId: "tmpl_staff", name: "Staff Performance Review", category: "staff_performance", description: "", complexityMultiplier: 1.2, isBuiltin: true, companyId: "demo", icon: "" },
  { templateId: "tmpl_customer", name: "Customer Sentiment Analysis", category: "customer_interaction", description: "", complexityMultiplier: 1.0, isBuiltin: true, companyId: "demo", icon: "" },
  { templateId: "tmpl_compliance", name: "Compliance & Policy Audit", category: "compliance_policy", description: "", complexityMultiplier: 1.5, isBuiltin: true, companyId: "demo", icon: "" },
  { templateId: "tmpl_sales", name: "Sales Performance Tracker", category: "sales_revenue", description: "", complexityMultiplier: 1.0, isBuiltin: true, companyId: "demo", icon: "" },
];

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC",
];

const DAYS = [
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
  { label: "S", value: 0 },
];

export interface CreateSchedulePayload {
  template_id: string;
  mic_ids?: string[];
  shop_ids?: string[];
  schedule_type: "recurring" | "one_time";
  recurrence_rule: string;
  analysis_window_hours: number;
  analysis_start_time: string;
  analysis_end_time: string;
  timezone: string;
  free_text_notes?: string;
  next_run_unix: number;
}

interface ScheduleFormProps {
  initial?: AnalysisSchedule | null;
  onSubmit: (data: CreateSchedulePayload) => Promise<void>;
  onCancel: () => void;
}

function buildCron(days: number[], hour: number, minute: number): string {
  const dayStr = [...days].sort((a, b) => a - b).join(",");
  return `${minute} ${hour} * * ${dayStr}`;
}

export function ScheduleForm({ initial, onSubmit, onCancel }: ScheduleFormProps) {
  const isEdit = !!initial;

  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");
  const [selectedMicIds, setSelectedMicIds] = useState<string[]>(initial?.micIds ?? []);
  const [scheduleType, setScheduleType] = useState<"recurring" | "one_time">(initial?.scheduleType ?? "recurring");

  const initialCron = initial?.recurrenceRule ? parseCron(initial.recurrenceRule) : { days: [1, 2, 3, 4, 5], hour: 9, minute: 0 };
  const [selectedDays, setSelectedDays] = useState<number[]>(initialCron.days);
  const [triggerTime, setTriggerTime] = useState(
    `${String(initialCron.hour).padStart(2, "0")}:${String(initialCron.minute).padStart(2, "0")}`
  );

  const [oneTimeDate, setOneTimeDate] = useState("");
  const [oneTimeTime, setOneTimeTime] = useState("09:00");

  const [analysisStart, setAnalysisStart] = useState(initial?.analysisStartTime ?? "09:00");
  const [analysisEnd, setAnalysisEnd] = useState(initial?.analysisEndTime ?? "18:00");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Kolkata");

  const [showNotes, setShowNotes] = useState(!!initial?.freeTextNotes);
  const [notes, setNotes] = useState(initial?.freeTextNotes ?? "");

  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimating, setEstimating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Load templates + devices in parallel
  useEffect(() => {
    if (IS_DEMO) {
      setTemplates(DEMO_TEMPLATES);
      setDevices(DEMO_DEVICES);
      setDataLoading(false);
      return;
    }
    Promise.all([
      listTemplates().catch(() => []),
      apiFetch<RawDevice[]>("/devices").then((raw) => (raw ?? []).map(normalizeDevice)).catch(() => []),
    ]).then(([tmpls, devs]) => {
      setTemplates(tmpls);
      setDevices(devs);
      setDataLoading(false);
    });
  }, []);

  const effectiveMicIds = useCallback((): string[] => selectedMicIds, [selectedMicIds]);

  // Credit estimate (debounced)
  useEffect(() => {
    let cancelled = false;
    const mics = effectiveMicIds();
    if (!templateId || mics.length === 0 || !analysisStart || !analysisEnd) {
      setEstimate(null);
      return;
    }

    const today = new Date();
    const [sh, sm] = analysisStart.split(":").map(Number);
    const [eh, em] = analysisEnd.split(":").map(Number);
    const startTs = new Date(today.getFullYear(), today.getMonth(), today.getDate(), sh, sm, 0);
    const endTs = new Date(today.getFullYear(), today.getMonth(), today.getDate(), eh, em, 0);
    if (endTs <= startTs) { setEstimate(null); return; }

    if (IS_DEMO) {
      const durMin = (endTs.getTime() - startTs.getTime()) / 60000;
      const tmpl = templates.find((t) => t.templateId === templateId);
      if (!cancelled) {
        setEstimate({
          estimatedCredits: Math.round(durMin * mics.length * (tmpl?.complexityMultiplier ?? 1) * 0.5),
          estimatedDurationMin: durMin,
          totalAudioDurationMs: durMin * 60000,
          hasAudio: true,
        });
      }
      return () => { cancelled = true; };
    }

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setEstimating(true);
      try {
        const result = await estimateCredits({
          template_id: templateId,
          mic_ids: mics,
          shop_ids: [],
          time_range_start_unix: Math.floor(startTs.getTime() / 1000),
          time_range_end_unix: Math.floor(endTs.getTime() / 1000),
        });
        if (!cancelled) setEstimate(result);
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 600);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [templateId, analysisStart, analysisEnd, effectiveMicIds, templates]);

  function toggleDay(day: number) {
    setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  function toggleMic(micId: string) {
    setSelectedMicIds((prev) => prev.includes(micId) ? prev.filter((m) => m !== micId) : [...prev, micId]);
  }

  function selectAllMics() {
    setSelectedMicIds(devices.map((d) => d.device_id));
  }

  function clearMics() {
    setSelectedMicIds([]);
  }

  function buildPayload(): CreateSchedulePayload | null {
    if (!templateId || selectedMicIds.length === 0) return null;

    let recurrenceRule = "";
    let nextRunUnix = 0;

    if (scheduleType === "recurring") {
      if (selectedDays.length === 0) return null;
      const [h, m] = triggerTime.split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      recurrenceRule = buildCron(selectedDays, h, m);
      // Backend's computeNextRun handles timezone-correct computation on first tick.
      nextRunUnix = Math.floor(Date.now() / 1000);
    } else {
      if (!oneTimeDate || !oneTimeTime) return null;
      recurrenceRule = `once:${oneTimeDate}T${oneTimeTime}`;
      const dt = new Date(`${oneTimeDate}T${oneTimeTime}:00`);
      nextRunUnix = Math.floor(dt.getTime() / 1000);
    }

    let analysisWindowHours = 8;
    if (analysisStart && analysisEnd) {
      const [sh] = analysisStart.split(":").map(Number);
      const [eh] = analysisEnd.split(":").map(Number);
      const hours = eh - sh;
      if (hours > 0) analysisWindowHours = Math.ceil(hours);
    }

    return {
      template_id: templateId,
      mic_ids: selectedMicIds,
      shop_ids: [],
      schedule_type: scheduleType,
      recurrence_rule: recurrenceRule,
      analysis_window_hours: analysisWindowHours,
      analysis_start_time: analysisStart,
      analysis_end_time: analysisEnd,
      timezone,
      free_text_notes: notes || undefined,
      next_run_unix: nextRunUnix,
    };
  }

  async function handleSubmit() {
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit(payload);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to save schedule");
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = !!buildPayload();

  // Shared classes
  const field = "w-full rounded-md border border-border bg-transparent px-3 h-9 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const label = "text-xs font-medium text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">
          {isEdit ? "Edit schedule" : "New schedule"}
        </h3>
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Template */}
        <div>
          <label htmlFor="sched-template" className={label}>Template</label>
          <div className="mt-1.5">
            {isEdit ? (
              <div className="text-sm text-foreground h-9 flex items-center px-3 rounded-md bg-muted/30 border border-border">
                {templates.find((t) => t.templateId === templateId)?.name ?? templateId}
              </div>
            ) : (
              <div className="relative">
                <select
                  id="sched-template"
                  className={cn(field, "appearance-none pr-8 cursor-pointer")}
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={dataLoading}
                >
                  <option value="">{dataLoading ? "Loading…" : "Select a template"}</option>
                  {templates.map((t) => (
                    <option key={t.templateId} value={t.templateId}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Devices */}
        <div>
          <div className="flex items-center justify-between">
            <label className={label}>
              Devices
              {selectedMicIds.length > 0 && (
                <span className="ml-1.5 text-foreground/70">· {selectedMicIds.length} selected</span>
              )}
            </label>
            {devices.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <button onClick={selectAllMics} className="hover:text-foreground transition-colors">All</button>
                <button onClick={clearMics} className="hover:text-foreground transition-colors">None</button>
              </div>
            )}
          </div>
          <div className="mt-1.5 rounded-md border border-border max-h-40 overflow-y-auto">
            {dataLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading devices…
              </div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-3">No devices found.</p>
            ) : devices.map((device) => {
              const selected = selectedMicIds.includes(device.device_id);
              return (
                <button
                  key={device.device_id}
                  onClick={() => toggleMic(device.device_id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-b border-border/40 last:border-b-0",
                    selected ? "bg-primary/5" : "hover:bg-muted/20"
                  )}
                >
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border shrink-0",
                    selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                  )}>
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="text-sm text-foreground flex-1 truncate">{device.label || device.device_id}</span>
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    device.status === "online" || device.status === "streaming" ? "bg-status-online"
                      : device.status === "pending" ? "bg-status-pending"
                      : "bg-muted-foreground/30"
                  )} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule: type + days/time */}
        <div>
          <label className={label}>Run</label>
          <div className="mt-1.5 flex gap-1 rounded-md border border-border p-0.5 w-fit">
            {(["recurring", "one_time"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setScheduleType(type)}
                className={cn(
                  "px-3 h-7 rounded text-xs font-medium transition-colors",
                  scheduleType === type ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {type === "recurring" ? "Recurring" : "One-time"}
              </button>
            ))}
          </div>

          {scheduleType === "recurring" ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {/* Day pills */}
              <div className="flex gap-1">
                {DAYS.map((day, idx) => {
                  const selected = selectedDays.includes(day.value);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        "h-9 w-9 rounded-md text-xs font-semibold transition-colors border",
                        selected
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                      aria-label={`Toggle day ${day.label}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {/* Time */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">at</span>
                <input
                  type="time"
                  className={cn(field, "w-28")}
                  value={triggerTime}
                  onChange={(e) => setTriggerTime(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-3">
              <input type="date" className={cn(field, "flex-1")} value={oneTimeDate} onChange={(e) => setOneTimeDate(e.target.value)} />
              <input type="time" className={cn(field, "w-28")} value={oneTimeTime} onChange={(e) => setOneTimeTime(e.target.value)} />
            </div>
          )}
        </div>

        {/* Analysis window + timezone on one row */}
        <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-3">
          <div>
            <label htmlFor="sched-astart" className={label}>Analyze from</label>
            <input id="sched-astart" type="time" className={cn(field, "mt-1.5")} value={analysisStart} onChange={(e) => setAnalysisStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sched-aend" className={label}>to</label>
            <input id="sched-aend" type="time" className={cn(field, "mt-1.5")} value={analysisEnd} onChange={(e) => setAnalysisEnd(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sched-tz" className={label}>Timezone</label>
            <div className="relative mt-1.5">
              <select
                id="sched-tz"
                className={cn(field, "appearance-none pr-8 cursor-pointer")}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Notes — progressive disclosure */}
        <div>
          {showNotes ? (
            <>
              <label htmlFor="sched-notes" className={label}>Notes</label>
              <textarea
                id="sched-notes"
                className="mt-1.5 w-full h-16 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. Focus on shift handover periods"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </>
          ) : (
            <button
              onClick={() => setShowNotes(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add notes
            </button>
          )}
        </div>
      </div>

      {/* Footer: estimate + actions */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border/60">
        <div className="flex items-center gap-2 text-xs min-w-0">
          {estimating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Calculating…</span>
            </>
          ) : estimate ? (
            <>
              <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-foreground font-medium">~{estimate.estimatedCredits} credits</span>
              <span className="text-muted-foreground">· {estimate.estimatedDurationMin.toFixed(0)}m audio</span>
            </>
          ) : submitError ? (
            <span className="text-status-offline" role="alert">{submitError}</span>
          ) : (
            <span className="text-muted-foreground">Select devices to see cost</span>
          )}
        </div>
        <Button size="sm" onClick={handleSubmit} disabled={!isValid || submitting}>
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          {isEdit ? "Update" : "Create schedule"}
        </Button>
      </div>
    </div>
  );
}
