"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Check, Cpu, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listTemplates, estimateCredits, apiFetch, normalizeDevice } from "@/lib/api";
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
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export interface CreateSchedulePayload {
  template_id: string;
  mic_ids?: string[];
  shop_ids?: string[];
  schedule_type: "recurring" | "one_time";
  recurrence_rule: string;
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
  const dayStr = days.sort().join(",");
  return `${minute} ${hour} * * ${dayStr}`;
}

function computeNextRun(days: number[], hour: number, minute: number): number {
  const now = new Date();
  const candidates: Date[] = days.map((dow) => {
    const d = new Date(now);
    const currentDow = d.getDay(); // 0=Sun
    let diff = dow - currentDow;
    if (diff < 0) diff += 7;
    d.setDate(d.getDate() + diff);
    d.setHours(hour, minute, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 7);
    return d;
  });
  if (candidates.length === 0) return Math.floor(now.getTime() / 1000) + 86400;
  const nearest = candidates.reduce((a, b) => (a < b ? a : b));
  return Math.floor(nearest.getTime() / 1000);
}

function parseCron(cron: string): { days: number[]; hour: number; minute: number } {
  const parts = cron.split(" ");
  if (parts.length !== 5) return { days: [1, 2, 3, 4, 5], hour: 9, minute: 0 };
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 9;
  const dowStr = parts[4];
  let days: number[] = [];
  if (dowStr === "*") {
    days = [0, 1, 2, 3, 4, 5, 6];
  } else if (dowStr === "1-5") {
    days = [1, 2, 3, 4, 5];
  } else if (dowStr === "1-6") {
    days = [1, 2, 3, 4, 5, 6];
  } else {
    days = dowStr.split(",").map((d) => parseInt(d)).filter((n) => !isNaN(n));
  }
  return { days, hour, minute };
}

// Group devices by shop_id
function groupByShop(devices: Device[]): Map<string, Device[]> {
  const map = new Map<string, Device[]>();
  for (const d of devices) {
    if (!map.has(d.shop_id)) map.set(d.shop_id, []);
    map.get(d.shop_id)!.push(d);
  }
  return map;
}

// Get a display name for a shop — fallback to shop_id
function shopDisplayName(shopId: string, devices: Device[]): string {
  const device = devices.find((d) => d.shop_id === shopId);
  if (device?.location) return device.location;
  return shopId;
}

export function ScheduleForm({ initial, onSubmit, onCancel }: ScheduleFormProps) {
  const isEdit = !!initial;

  // Form state
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");
  const [targetMode, setTargetMode] = useState<"shop" | "device">(
    initial?.shopIds && initial.shopIds.length > 0 ? "shop" : "device"
  );
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>(initial?.shopIds ?? []);
  const [selectedMicIds, setSelectedMicIds] = useState<string[]>(initial?.micIds ?? []);
  const [scheduleType, setScheduleType] = useState<"recurring" | "one_time">(initial?.scheduleType ?? "recurring");

  // Parse initial cron
  const initialCron = initial?.recurrenceRule ? parseCron(initial.recurrenceRule) : { days: [1, 2, 3, 4, 5], hour: 9, minute: 0 };
  const [selectedDays, setSelectedDays] = useState<number[]>(initialCron.days);
  const [triggerHour, setTriggerHour] = useState(initialCron.hour);
  const [triggerMinute, setTriggerMinute] = useState(initialCron.minute);

  // One-time
  const [oneTimeDate, setOneTimeDate] = useState("");
  const [oneTimeTime, setOneTimeTime] = useState("09:00");

  // Analysis window
  const [analysisStart, setAnalysisStart] = useState(initial?.analysisStartTime ?? "09:00");
  const [analysisEnd, setAnalysisEnd] = useState(initial?.analysisEndTime ?? "18:00");

  // Timezone
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Kolkata");

  // Notes
  const [notes, setNotes] = useState(initial?.freeTextNotes ?? "");

  // Data
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(true);

  // Credit estimate
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Load templates
  useEffect(() => {
    if (IS_DEMO) {
      setTemplates(DEMO_TEMPLATES);
      setTemplatesLoading(false);
      return;
    }
    listTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  // Load devices
  useEffect(() => {
    if (IS_DEMO) {
      setDevices(DEMO_DEVICES);
      setDevicesLoading(false);
      return;
    }
    apiFetch<RawDevice[]>("/devices")
      .then((raw) => setDevices((raw ?? []).map(normalizeDevice)))
      .catch(() => {})
      .finally(() => setDevicesLoading(false));
  }, []);

  // Compute effective mic_ids for estimation
  const effectiveMicIds = useCallback((): string[] => {
    if (targetMode === "device") return selectedMicIds;
    return devices.filter((d) => selectedShopIds.includes(d.shop_id)).map((d) => d.device_id);
  }, [targetMode, selectedMicIds, selectedShopIds, devices]);

  // Run credit estimate when key fields are set
  useEffect(() => {
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
      setEstimate({
        estimatedCredits: Math.round(durMin * mics.length * (tmpl?.complexityMultiplier ?? 1) * 0.5),
        estimatedDurationMin: durMin,
        totalAudioDurationMs: durMin * 60000,
        hasAudio: true,
      });
      return;
    }

    const timer = setTimeout(() => {
      setEstimating(true);
      estimateCredits({
        template_id: templateId,
        mic_ids: mics,
        shop_ids: targetMode === "shop" ? selectedShopIds : [],
        time_range_start_unix: Math.floor(startTs.getTime() / 1000),
        time_range_end_unix: Math.floor(endTs.getTime() / 1000),
      })
        .then(setEstimate)
        .catch(() => setEstimate(null))
        .finally(() => setEstimating(false));
    }, 600);

    return () => clearTimeout(timer);
  }, [templateId, analysisStart, analysisEnd, effectiveMicIds, templates, targetMode, selectedShopIds]);

  const shopGroups = groupByShop(devices);
  const shopIds = Array.from(shopGroups.keys());

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function toggleShop(shopId: string) {
    setSelectedShopIds((prev) =>
      prev.includes(shopId) ? prev.filter((s) => s !== shopId) : [...prev, shopId]
    );
  }

  function toggleMic(micId: string) {
    setSelectedMicIds((prev) =>
      prev.includes(micId) ? prev.filter((m) => m !== micId) : [...prev, micId]
    );
  }

  function buildPayload(): CreateSchedulePayload | null {
    if (!templateId) return null;
    const mics = effectiveMicIds();
    if (mics.length === 0 && selectedShopIds.length === 0) return null;

    let recurrenceRule = "";
    let nextRunUnix = 0;

    if (scheduleType === "recurring") {
      if (selectedDays.length === 0) return null;
      const hourStr = String(triggerHour).padStart(2, "0");
      const minuteStr = String(triggerMinute).padStart(2, "0");
      recurrenceRule = buildCron(selectedDays, triggerHour, triggerMinute);
      nextRunUnix = computeNextRun(selectedDays, triggerHour, triggerMinute);
      void hourStr; void minuteStr;
    } else {
      if (!oneTimeDate || !oneTimeTime) return null;
      recurrenceRule = `once:${oneTimeDate}T${oneTimeTime}`;
      const dt = new Date(`${oneTimeDate}T${oneTimeTime}:00`);
      nextRunUnix = Math.floor(dt.getTime() / 1000);
    }

    return {
      template_id: templateId,
      mic_ids: targetMode === "device" ? selectedMicIds : mics,
      shop_ids: targetMode === "shop" ? selectedShopIds : [],
      schedule_type: scheduleType,
      recurrence_rule: recurrenceRule,
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

  const inputClass =
    "w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const labelClass = "text-xs font-medium text-muted-foreground mb-1.5 block";

  return (
    <div className="rounded-xl border border-border bg-card/50 p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {isEdit ? "Edit Schedule" : "New Schedule"}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure recurring or one-time audio analysis
        </p>
      </div>

      {/* Template Selector */}
      <div>
        <label htmlFor="sched-template" className={labelClass}>Template</label>
        {templatesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates...
          </div>
        ) : (
          <div className="relative">
            <select
              id="sched-template"
              className={cn(inputClass, "appearance-none pr-8 cursor-pointer")}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.templateId} value={t.templateId}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Target Switcher */}
      <div>
        <p className={labelClass}>Target</p>
        <div className="flex gap-2 mb-4">
          {(["shop", "device"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTargetMode(mode)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                targetMode === mode
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
              )}
            >
              {mode === "shop" ? "By location" : "By device"}
            </button>
          ))}
        </div>

        {devicesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading devices...
          </div>
        ) : targetMode === "shop" ? (
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {shopIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shops found.</p>
            ) : shopIds.map((shopId) => {
              const shopDevices = shopGroups.get(shopId) ?? [];
              const selected = selectedShopIds.includes(shopId);
              return (
                <button
                  key={shopId}
                  onClick={() => toggleShop(shopId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors",
                    selected ? "bg-primary/5" : "hover:bg-muted/20"
                  )}
                >
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border shrink-0 transition-colors",
                    selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                  )}>
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{shopDisplayName(shopId, devices)}</p>
                    <p className="text-xs text-muted-foreground">{shopDevices.length} device{shopDevices.length !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {devices.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/20 p-6 text-center">
                <Cpu className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No devices found</p>
              </div>
            ) : devices.map((device) => {
              const selected = selectedMicIds.includes(device.device_id);
              return (
                <button
                  key={device.device_id}
                  onClick={() => toggleMic(device.device_id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors",
                    selected ? "bg-primary/5" : "hover:bg-muted/20"
                  )}
                >
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border shrink-0 transition-colors",
                    selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                  )}>
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{device.label || device.device_id}</p>
                    <p className="text-xs text-muted-foreground">{shopDisplayName(device.shop_id, devices)}</p>
                  </div>
                  <span className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    device.status === "online" || device.status === "streaming" ? "bg-emerald-500"
                      : device.status === "pending" ? "bg-amber-400"
                      : "bg-muted-foreground/30"
                  )} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Type Toggle */}
      <div>
        <p className={labelClass}>Schedule type</p>
        <div className="flex gap-2 mb-4">
          {(["recurring", "one_time"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setScheduleType(type)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                scheduleType === type
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
              )}
            >
              {type === "recurring" ? "Recurring" : "One-time"}
            </button>
          ))}
        </div>

        {scheduleType === "recurring" ? (
          <div className="space-y-4">
            {/* Day checkboxes */}
            <div>
              <p className={labelClass}>Days</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const selected = selectedDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                        selected
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Trigger time */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="sched-hour" className={labelClass}>Hour (0–23)</label>
                <input
                  id="sched-hour"
                  type="number"
                  min={0}
                  max={23}
                  className={inputClass}
                  value={triggerHour}
                  onChange={(e) => setTriggerHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="sched-minute" className={labelClass}>Minute (0–59)</label>
                <input
                  id="sched-minute"
                  type="number"
                  min={0}
                  max={59}
                  className={inputClass}
                  value={triggerMinute}
                  onChange={(e) => setTriggerMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="sched-date" className={labelClass}>Date</label>
              <input
                id="sched-date"
                type="date"
                className={inputClass}
                value={oneTimeDate}
                onChange={(e) => setOneTimeDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="sched-time" className={labelClass}>Time</label>
              <input
                id="sched-time"
                type="time"
                className={inputClass}
                value={oneTimeTime}
                onChange={(e) => setOneTimeTime(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Analysis Window */}
      <div>
        <p className={labelClass}>Analysis window</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="sched-astart" className="text-xs text-muted-foreground mb-1.5 block">Start time</label>
            <input
              id="sched-astart"
              type="time"
              className={inputClass}
              value={analysisStart}
              onChange={(e) => setAnalysisStart(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="sched-aend" className="text-xs text-muted-foreground mb-1.5 block">End time</label>
            <input
              id="sched-aend"
              type="time"
              className={inputClass}
              value={analysisEnd}
              onChange={(e) => setAnalysisEnd(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="sched-tz" className={labelClass}>Timezone</label>
        <div className="relative">
          <select
            id="sched-tz"
            className={cn(inputClass, "appearance-none pr-8 cursor-pointer")}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="sched-notes" className={labelClass}>Notes (optional)</label>
        <textarea
          id="sched-notes"
          className="w-full h-20 rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm text-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="e.g. Focus on shift handover periods"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Credit estimate */}
      {(estimate || estimating) && (
        <div className={cn(
          "rounded-xl border p-4 flex items-center gap-3",
          estimate ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
        )}>
          {estimating ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <Zap className="h-4 w-4 text-primary shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Estimated cost per run</p>
            {estimate && !estimating && (
              <p className="text-sm font-semibold text-primary">
                ~{estimate.estimatedCredits} credits
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  ({estimate.estimatedDurationMin.toFixed(0)} min audio)
                </span>
              </p>
            )}
            {estimating && <p className="text-xs text-muted-foreground">Calculating…</p>}
          </div>
        </div>
      )}

      {submitError && (
        <p className="text-sm text-red-400" role="alert">{submitError}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={!isValid || submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Update Schedule" : "Create Schedule"}
        </Button>
      </div>
    </div>
  );
}
