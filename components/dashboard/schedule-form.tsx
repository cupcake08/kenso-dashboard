"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Zap, ChevronDown, Moon, AlertCircle, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { estimateCredits, apiFetch, normalizeCredits, normalizeDevice } from "@/lib/api";
import { parseCron, expandCronDays } from "@/lib/cron";
import { useApi } from "@/hooks/use-api";
import { useSubscription } from "@/hooks/use-subscription";
import type { AnalysisSchedule, EstimateResult } from "@/types/analysis";
import type { Device, RawCreditsResponse, RawDevice } from "@/types/api";

// Format minutes (1 credit = 1 minute) into something a customer reads.
function formatMinAsHours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

// Approximate runs-per-month from a 5-field cron rule. Counts firing days
// from the day-of-week field × 4.345 weeks per month. Good enough for the
// "this schedule will use ~Xh/month" capacity preview — not a billing-grade
// forecast.
function runsPerMonthFromCron(cron: string): number {
  const parts = cron.split(" ");
  if (parts.length !== 5) return 30; // fallback: assume daily
  const days = expandCronDays(parts[4]);
  return Math.max(1, Math.round(days.length * 4.345));
}

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_DEVICES: Device[] = [
  { device_id: "mic_lobby_01", shop_id: "shop_001", label: "Lobby Mic", location: "Koramangala", status: "online", last_seen_at: "" },
  { device_id: "mic_counter_02", shop_id: "shop_001", label: "Counter Mic", location: "Koramangala", status: "online", last_seen_at: "" },
  { device_id: "mic_back_03", shop_id: "shop_001", label: "Back Office", location: "Koramangala", status: "offline", last_seen_at: "" },
  { device_id: "mic_floor_01", shop_id: "shop_002", label: "Floor Mic", location: "Indiranagar", status: "online", last_seen_at: "" },
  { device_id: "mic_entry_01", shop_id: "shop_002", label: "Entry Gate", location: "Indiranagar", status: "online", last_seen_at: "" },
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

// Convert a wall-clock datetime in a specific IANA timezone to a unix timestamp.
// Uses Intl.DateTimeFormat to determine the offset at that moment (handles DST).
function zonedWallTimeToUnix(year: number, month: number, day: number, hour: number, minute: number, tz: string): number {
  // Treat wall-clock as UTC first
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Read what that UTC moment looks like in the target timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcGuess));
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  const tzWall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = tzWall - utcGuess;
  return Math.floor((utcGuess - offsetMs) / 1000);
}

// Get YYYY-MM-DD for "today" in the given timezone, then subtract one day.
function yesterdayInTimezone(tz: string): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const todayStr = fmt.format(new Date()); // "2026-04-11"
  const [y, m, d] = todayStr.split("-").map(Number);
  const yest = new Date(Date.UTC(y, m - 1, d));
  yest.setUTCDate(yest.getUTCDate() - 1);
  return {
    year: yest.getUTCFullYear(),
    month: yest.getUTCMonth() + 1,
    day: yest.getUTCDate(),
  };
}

// Fallback theoretical estimate when no audio exists for yesterday.
// Assumes ~50% voice activity during the window (realistic for retail).
const VOICE_ACTIVITY_RATIO = 0.5;
function theoreticalEstimate(windowMinutes: number, deviceCount: number, complexityMultiplier: number): number {
  const credits = Math.ceil(windowMinutes * deviceCount * complexityMultiplier * VOICE_ACTIVITY_RATIO);
  return Math.max(1, credits);
}

export function ScheduleForm({ initial, onSubmit, onCancel }: ScheduleFormProps) {
  const isEdit = !!initial;
  const router = useRouter();
  const { needsUpgrade } = useSubscription();
  // Current credit balance — used to preview whether the schedule is sustainable.
  const { data: credits } = useApi<ReturnType<typeof normalizeCredits>>(
    IS_DEMO ? null : "/credits",
    async (url) => normalizeCredits(await apiFetch<RawCreditsResponse>(url)),
  );
  const balanceMin = credits?.balance ?? 0;

  const [selectedMicIds, setSelectedMicIds] = useState<string[]>(initial?.micIds ?? []);
  const [scheduleType, setScheduleType] = useState<"recurring" | "one_time">(initial?.scheduleType ?? "recurring");

  const initialCron = initial?.recurrenceRule ? parseCron(initial.recurrenceRule) : { days: [1, 2, 3, 4, 5], hour: 18, minute: 0 };
  const [selectedDays, setSelectedDays] = useState<number[]>(initialCron.days);

  const [oneTimeDate, setOneTimeDate] = useState("");

  const [analysisStart, setAnalysisStart] = useState(initial?.analysisStartTime ?? "09:00");
  const [analysisEnd, setAnalysisEnd] = useState(initial?.analysisEndTime ?? "18:00");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Kolkata");

  const [showNotes, setShowNotes] = useState(!!initial?.freeTextNotes);
  const [notes, setNotes] = useState(initial?.freeTextNotes ?? "");

  const [devices, setDevices] = useState<Device[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimateSource, setEstimateSource] = useState<"historical" | "theoretical" | null>(null);
  const [estimating, setEstimating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Load devices
  useEffect(() => {
    if (IS_DEMO) {
      setDevices(DEMO_DEVICES);
      setDataLoading(false);
      return;
    }
    apiFetch<RawDevice[]>("/devices")
      .then((raw) => (raw ?? []).map(normalizeDevice))
      .catch(() => [])
      .then((devs) => {
        setDevices(devs);
        setDataLoading(false);
      });
  }, []);

  // Credit estimate: query yesterday's audio in the target timezone.
  // If yesterday had audio, show "~N credits per run". Otherwise, estimate 50% voice activity.
  useEffect(() => {
    let cancelled = false;
    const mics = selectedMicIds;
    if (mics.length === 0 || !analysisStart || !analysisEnd) {
      setEstimate(null);
      setEstimateSource(null);
      return;
    }

    const [sh, sm] = analysisStart.split(":").map(Number);
    const [eh, em] = analysisEnd.split(":").map(Number);
    if (isNaN(sh) || isNaN(em) || isNaN(eh) || isNaN(sm)) {
      setEstimate(null); setEstimateSource(null); return;
    }

    // Compute the most recent past run of this window in the selected tz.
    // Same-day window (09:00–18:00): yesterday 09:00 → yesterday 18:00.
    // Overnight window (22:00–06:00): the previous completed overnight,
    //   which is (day-before-yesterday) 22:00 → yesterday 06:00.
    const { year, month, day } = yesterdayInTimezone(timezone);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    const isOvernight = endMinutes <= startMinutes;

    let startUnix: number;
    let endUnix: number;
    if (isOvernight) {
      // yesterday ends with the morning of 'day'; start is 'day-1' wall-clock.
      const prev = new Date(Date.UTC(year, month - 1, day));
      prev.setUTCDate(prev.getUTCDate() - 1);
      startUnix = zonedWallTimeToUnix(
        prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(),
        sh, sm, timezone
      );
      endUnix = zonedWallTimeToUnix(year, month, day, eh, em, timezone);
    } else {
      startUnix = zonedWallTimeToUnix(year, month, day, sh, sm, timezone);
      endUnix = zonedWallTimeToUnix(year, month, day, eh, em, timezone);
    }
    if (endUnix <= startUnix) { setEstimate(null); setEstimateSource(null); return; }

    const windowMinutes = (endUnix - startUnix) / 60;
    const multiplier = 1;

    if (IS_DEMO) {
      if (!cancelled) {
        // Demo uses the theoretical formula consistently
        const credits = theoreticalEstimate(windowMinutes, mics.length, multiplier);
        setEstimate({
          estimatedCredits: credits,
          estimatedDurationMin: windowMinutes * VOICE_ACTIVITY_RATIO,
          totalAudioDurationMs: windowMinutes * VOICE_ACTIVITY_RATIO * 60000,
          hasAudio: true,
          estimatedHours: Math.round(windowMinutes / 6) / 10,
          estimatedCostInr: Math.round(windowMinutes / 60 * 40),
        });
        setEstimateSource("theoretical");
      }
      return () => { cancelled = true; };
    }

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setEstimating(true);
      try {
        const result = await estimateCredits({
          mic_ids: mics,
          shop_ids: [],
          time_range_start_unix: startUnix,
          time_range_end_unix: endUnix,
        });
        if (cancelled) return;
        if (result.hasAudio && result.estimatedCredits > 0) {
          setEstimate(result);
          setEstimateSource("historical");
        } else {
          // No audio yesterday — fall back to theoretical
          const credits = theoreticalEstimate(windowMinutes, mics.length, multiplier);
          setEstimate({
            estimatedCredits: credits,
            estimatedDurationMin: windowMinutes * VOICE_ACTIVITY_RATIO,
            totalAudioDurationMs: windowMinutes * VOICE_ACTIVITY_RATIO * 60000,
            hasAudio: false,
            estimatedHours: Math.round(windowMinutes / 6) / 10,
            estimatedCostInr: Math.round(windowMinutes / 60 * 40),
          });
          setEstimateSource("theoretical");
        }
      } catch {
        if (!cancelled) { setEstimate(null); setEstimateSource(null); }
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 600);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [analysisStart, analysisEnd, selectedMicIds, timezone]);

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
    if (selectedMicIds.length === 0) return null;
    if (!analysisStart || !analysisEnd) return null;
    // Reject zero-length windows (backend rejects these too; fail fast in UI).
    if (analysisStart === analysisEnd) return null;

    // Trigger time is derived from the end of the analysis window:
    // the job fires once the window has closed, so it can process
    // the whole day's audio for [analysisStart, analysisEnd].
    const [endH, endM] = analysisEnd.split(":").map(Number);
    const [startH, startM] = analysisStart.split(":").map(Number);
    if (isNaN(endH) || isNaN(endM) || isNaN(startH) || isNaN(startM)) return null;

    let recurrenceRule = "";
    let nextRunUnix = 0;

    if (scheduleType === "recurring") {
      if (selectedDays.length === 0) return null;
      recurrenceRule = buildCron(selectedDays, endH, endM);
      // For recurring schedules the server computes NextRunAt from the cron
      // rule + timezone — we send 0 as a placeholder and let the backend
      // pick the correct next occurrence. Previously this sent Date.now(),
      // which caused the engine to fire the job immediately on creation
      // regardless of the Mon-Fri filter.
      nextRunUnix = 0;
    } else {
      if (!oneTimeDate) return null;
      recurrenceRule = `once:${oneTimeDate}T${analysisEnd}`;
      // Parse the picked local date in the SCHEDULE's timezone, not the
      // browser's. `new Date("YYYY-MM-DDTHH:MM:00")` parses as browser-local,
      // which is wrong whenever the ops manager is in a different tz than
      // the store (e.g., manager in NYC configuring a store in Kolkata).
      const [y, mo, d] = oneTimeDate.split("-").map(Number);
      nextRunUnix = zonedWallTimeToUnix(y, mo, d, endH, endM, timezone);
    }

    // Compute window duration in hours. For overnight windows (e.g.,
    // 22:00 → 06:00), the duration wraps past midnight, so add 24h.
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const minutesDelta = endMinutes > startMinutes
      ? endMinutes - startMinutes
      : (24 * 60) - startMinutes + endMinutes;
    const analysisWindowHours = Math.max(1, Math.ceil(minutesDelta / 60));

    return {
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
  const field = "w-full rounded-md border border-border bg-transparent px-3 h-9 text-[13px] text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const label = "text-[11px] font-medium text-muted-foreground tracking-wide";

  // Human-readable trigger preview — derived from end of window
  const triggerPreview = (() => {
    if (!analysisEnd) return null;
    const [h, m] = analysisEnd.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const hr12 = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hr12}:${String(m).padStart(2, "0")} ${ampm}`;
  })();

  // Detect overnight window (start time later in the day than end time).
  // Used to render a "spans midnight" affordance so the user isn't surprised
  // by the cross-day semantics.
  const isOvernight = (() => {
    if (!analysisStart || !analysisEnd) return false;
    const [sh, sm] = analysisStart.split(":").map(Number);
    const [eh, em] = analysisEnd.split(":").map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return false;
    return eh * 60 + em <= sh * 60 + sm && !(sh === eh && sm === em);
  })();

  // Total window duration in hours, wrapping past midnight for overnight.
  const windowHours = (() => {
    if (!analysisStart || !analysisEnd) return 0;
    const [sh, sm] = analysisStart.split(":").map(Number);
    const [eh, em] = analysisEnd.split(":").map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const delta = isOvernight ? (24 * 60 - startMin) + endMin : endMin - startMin;
    return delta / 60;
  })();

  return (
    <div className="rounded-lg border border-border bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
          {isEdit ? "Edit schedule" : "New schedule"}
        </h3>
        <button
          onClick={onCancel}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Devices */}
        <div>
          <div className="flex items-center justify-between">
            <label className={label}>
              Devices
              {selectedMicIds.length > 0 && (
                <span className="ml-1.5 text-foreground/70 tabular-nums">· {selectedMicIds.length} selected</span>
              )}
            </label>
            {devices.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                <button onClick={selectAllMics} className="hover:text-foreground transition-colors">All</button>
                <button onClick={clearMics} className="hover:text-foreground transition-colors">None</button>
              </div>
            )}
          </div>
          <div className="mt-1.5 rounded-md border border-border max-h-40 overflow-y-auto">
            {dataLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground px-3 py-2.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading devices…
              </div>
            ) : devices.length === 0 ? (
              <p className="text-[13px] text-muted-foreground px-3 py-2.5">No devices found.</p>
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
                  <span className="text-[13px] text-foreground flex-1 truncate">{device.label || device.device_id}</span>
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

        {/* Schedule: type + days + window */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={label}>Schedule</label>
            <div className="flex gap-0.5 rounded-md border border-border p-0.5">
              {(["recurring", "one_time"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setScheduleType(type)}
                  className={cn(
                    "px-2.5 h-6 rounded-sm text-[11px] font-medium transition-colors",
                    scheduleType === type ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type === "recurring" ? "Recurring" : "One-time"}
                </button>
              ))}
            </div>
          </div>

          {scheduleType === "recurring" ? (
            <div className="flex gap-1">
              {DAYS.map((day, idx) => {
                const selected = selectedDays.includes(day.value);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      "h-9 flex-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors border",
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
          ) : (
            <input
              type="date"
              className={field}
              value={oneTimeDate}
              onChange={(e) => setOneTimeDate(e.target.value)}
            />
          )}

          {/* Analysis window + timezone */}
          <div className="grid grid-cols-[1fr_auto_1fr_1.4fr] gap-2 items-end">
            <div>
              <label htmlFor="sched-astart" className={label}>Analyze from</label>
              <input id="sched-astart" type="time" className={cn(field, "mt-1.5")} value={analysisStart} onChange={(e) => setAnalysisStart(e.target.value)} />
            </div>
            <span
              className={cn(
                "pb-2.5 text-xs transition-colors",
                isOvernight ? "text-indigo-400" : "text-muted-foreground"
              )}
              aria-label={isOvernight ? "crosses midnight" : "to"}
              title={isOvernight ? "Window crosses midnight" : undefined}
            >
              {isOvernight ? "↷" : "→"}
            </span>
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

          {/* Overnight affordance — shows when the window spans midnight.
              Tells the user which day the cron day-picker refers to so they
              aren't surprised that "Mon" + "22:00→06:00" analyzes Sunday
              night's audio. */}
          {isOvernight && (
            <div className="flex items-start gap-2 rounded-md border border-indigo-500/30 bg-indigo-500/[0.06] px-3 py-2">
              <Moon className="h-3.5 w-3.5 shrink-0 text-indigo-400 mt-0.5" aria-hidden />
              <div className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-indigo-400">Overnight window</span>
                {" — "}
                <span className="tabular-nums">
                  spans midnight ({windowHours.toFixed(windowHours % 1 ? 1 : 0)}h total)
                </span>
                . On the day the job fires, it analyzes audio from{" "}
                <span className="tabular-nums text-foreground">{analysisStart}</span>{" "}
                the <span className="font-medium text-foreground">previous day</span> through{" "}
                <span className="tabular-nums text-foreground">{analysisEnd}</span>{" "}
                of that day.
              </div>
            </div>
          )}

          {/* Trigger preview — shows when the job will actually fire */}
          {triggerPreview && (
            <p className="text-[11px] text-muted-foreground">
              {scheduleType === "recurring"
                ? isOvernight
                  ? `Runs at ${triggerPreview} on selected days · processes the previous night's audio window.`
                  : `Runs at ${triggerPreview} on selected days · processes that day's audio window.`
                : isOvernight
                  ? `Runs at ${triggerPreview} on ${oneTimeDate || "the selected date"} · processes the previous night's audio window.`
                  : `Runs at ${triggerPreview} on ${oneTimeDate || "the selected date"} · processes that day's audio window.`}
            </p>
          )}
        </div>

        {/* Notes — progressive disclosure */}
        <div>
          {showNotes ? (
            <>
              <label htmlFor="sched-notes" className={label}>Notes</label>
              <textarea
                id="sched-notes"
                className="mt-1.5 w-full h-16 rounded-md border border-border bg-transparent px-3 py-2 text-[13px] text-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. Focus on shift handover periods"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </>
          ) : (
            <button
              onClick={() => setShowNotes(true)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add notes
            </button>
          )}
        </div>
      </div>

      {/* Sustainability preview — shown when we have an estimate, helps the
          customer see whether their balance can carry the schedule before they
          commit. All units in hours/minutes (not "credits") because that's
          what the customer thinks in. */}
      {estimate && estimate.estimatedCredits > 0 && (() => {
        const perRunMin = estimate.estimatedCredits;
        const [endHStr, endMStr] = analysisEnd.split(":");
        const monthlyMin = scheduleType === "recurring" && selectedDays.length > 0
          ? perRunMin * runsPerMonthFromCron(buildCron(selectedDays, parseInt(endHStr) || 0, parseInt(endMStr) || 0))
          : perRunMin;
        const runsCovered = balanceMin > 0 && perRunMin > 0 ? Math.floor(balanceMin / perRunMin) : 0;
        const cantCoverOneRun = balanceMin > 0 && balanceMin < perRunMin;
        const cantCoverMonth = scheduleType === "recurring" && balanceMin < monthlyMin;
        const showAnyWarning = balanceMin > 0 && (cantCoverOneRun || cantCoverMonth);

        if (!showAnyWarning) {
          return (
            <div className="px-5 pb-3 -mt-1">
              <div className="rounded-md bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="text-foreground font-medium tabular-nums">~{formatMinAsHours(perRunMin)} per run</span>
                {scheduleType === "recurring" && (
                  <>
                    <span className="mx-1.5 text-muted-foreground/40">·</span>
                    <span className="tabular-nums">~{formatMinAsHours(monthlyMin)}/month</span>
                  </>
                )}
                <span className="mx-1.5 text-muted-foreground/40">·</span>
                <span>{estimateSource === "historical" ? "based on yesterday" : "typical-day estimate"}</span>
              </div>
            </div>
          );
        }

        const isCritical = cantCoverOneRun;
        return (
          <div className="px-5 pb-3 -mt-1">
            <div className={cn(
              "rounded-lg border p-3",
              isCritical ? "bg-red-400/5 border-red-400/30" : "bg-amber-400/5 border-amber-400/30",
            )}>
              <div className="flex items-start gap-2.5">
                <AlertCircle className={cn("h-4 w-4 shrink-0 mt-0.5", isCritical ? "text-red-400" : "text-amber-400")} aria-hidden />
                <div className="flex-1 min-w-0" role={isCritical ? "alert" : "note"}>
                  {isCritical ? (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Not enough hours for even one run
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Each run needs ~{formatMinAsHours(perRunMin)}; you have {formatMinAsHours(balanceMin)}.
                        {needsUpgrade
                          ? " Upgrade to a paid plan first."
                          : " Top up your balance first."}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Balance covers ~{runsCovered} {runsCovered === 1 ? "run" : "runs"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This schedule will use ~{formatMinAsHours(monthlyMin)}/month at this cadence.
                        You have {formatMinAsHours(balanceMin)} —
                        {needsUpgrade
                          ? " upgrade to keep it running long-term."
                          : " top up to keep it running long-term."}
                      </p>
                    </>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={isCritical ? "default" : "outline"}
                  onClick={() => router.push(needsUpgrade ? "/dashboard/usage?upgrade=1" : "/dashboard/usage")}
                  className="shrink-0"
                >
                  {needsUpgrade ? (
                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" aria-hidden />Upgrade</>
                  ) : (
                    <><TrendingUp className="h-3.5 w-3.5 mr-1.5" aria-hidden />Top up</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Footer: status + actions. Cost preview moved into the sustainability
          panel above; this row stays minimal so the primary CTA dominates. */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border/60">
        <div className="flex items-center gap-2 text-[11px] min-w-0">
          {estimating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Calculating…</span>
            </>
          ) : !estimate && !submitError ? (
            <span className="text-muted-foreground">Select devices to see hours per run</span>
          ) : submitError ? (
            <span className="text-status-offline font-medium" role="alert">{submitError}</span>
          ) : null}
        </div>
        <Button size="sm" onClick={handleSubmit} disabled={!isValid || submitting}>
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          {isEdit ? "Update" : "Create schedule"}
        </Button>
      </div>
    </div>
  );
}
