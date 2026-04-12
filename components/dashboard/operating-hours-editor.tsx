"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Clock, PauseCircle, PlayCircle, Copy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OperatingSchedule, DaySchedule, DeviceOverride } from "@/types/analysis";

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function defaultWeeklyHours(): DaySchedule[] {
  return DAY_KEYS.map((day, i) => ({
    day,
    open: "09:00",
    close: "21:00",
    closed: i === 6, // Sunday closed
  }));
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  shopId: string;
  shopName: string;
  initial?: OperatingSchedule | null;
  devices: { micId: string; label: string }[];
  onSave: (data: {
    timezone: string;
    weekly_hours: DaySchedule[];
    device_overrides: Record<string, DeviceOverride>;
  }) => Promise<void>;
  onPause: (pausedUntil: string, reason: string) => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => void;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DayRow({
  day,
  schedule,
  onChange,
}: {
  day: string;
  schedule: DaySchedule;
  onChange: (s: DaySchedule) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={() => onChange({ ...schedule, closed: !schedule.closed })}
        className={cn(
          "w-10 h-5 rounded-full transition-colors relative shrink-0",
          schedule.closed ? "bg-muted" : "bg-primary"
        )}
        aria-label={schedule.closed ? `Open ${day}` : `Close ${day}`}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
            schedule.closed ? "left-0.5" : "left-[22px]"
          )}
        />
      </button>
      <span className="w-8 text-xs font-medium text-muted-foreground shrink-0">{day}</span>
      <AnimatePresence initial={false}>
        {schedule.closed ? (
          <motion.span
            key="closed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground/60 italic"
          >
            Closed
          </motion.span>
        ) : (
          <motion.div
            key="times"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            className="flex items-center gap-2"
          >
            <Input
              type="time"
              value={schedule.open}
              onChange={(e) => onChange({ ...schedule, open: e.target.value })}
              className="h-8 w-28 text-xs px-2"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="time"
              value={schedule.close}
              onChange={(e) => onChange({ ...schedule, close: e.target.value })}
              className="h-8 w-28 text-xs px-2"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WeeklyGrid({
  hours,
  onChange,
}: {
  hours: DaySchedule[];
  onChange: (hours: DaySchedule[]) => void;
}) {
  function updateDay(index: number, s: DaySchedule) {
    const next = [...hours];
    next[index] = s;
    onChange(next);
  }

  function applyMonToWeekdays() {
    const mon = hours[0];
    if (!mon) return;
    const next = hours.map((h, i) =>
      i >= 1 && i <= 4 ? { ...mon, day: h.day } : h
    );
    onChange(next);
  }

  return (
    <div>
      <div className="divide-y divide-border/50">
        {hours.map((h, i) => (
          <DayRow
            key={h.day}
            day={DAY_SHORT[i]}
            schedule={h}
            onChange={(s) => updateDay(i, s)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={applyMonToWeekdays}
        className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Copy className="h-3 w-3" />
        Apply Monday to weekdays (Tue–Fri)
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function OperatingHoursEditor({
  shopName,
  initial,
  devices,
  onSave,
  onPause,
  onResume,
  onCancel,
}: Props) {
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Kolkata");
  const [weeklyHours, setWeeklyHours] = useState<DaySchedule[]>(
    initial?.weekly_hours ?? defaultWeeklyHours()
  );

  // Device overrides state
  const [deviceOverrides, setDeviceOverrides] = useState<Record<string, DeviceOverride>>(
    initial?.device_overrides ?? {}
  );
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);

  // Pause state
  const [pauseDate, setPauseDate] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [showPauseForm, setShowPauseForm] = useState(false);

  // Loading state
  const [saving, setSaving] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const isPaused = !!(initial?.paused_until && new Date(initial.paused_until) > new Date());

  // ── Handlers ────────────────────────────────────────────────────────────────

  function toggleDeviceOverride(micId: string, label: string) {
    setDeviceOverrides((prev) => {
      if (prev[micId]) {
        const next = { ...prev };
        delete next[micId];
        if (expandedDeviceId === micId) setExpandedDeviceId(null);
        return next;
      }
      return {
        ...prev,
        [micId]: { label, weekly_hours: defaultWeeklyHours() },
      };
    });
  }

  function updateDeviceHours(micId: string, hours: DaySchedule[]) {
    setDeviceOverrides((prev) => ({
      ...prev,
      [micId]: { ...prev[micId], weekly_hours: hours },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      await onSave({ timezone, weekly_hours: weeklyHours, device_overrides: deviceOverrides });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePause() {
    if (!pauseDate) return;
    setActionError(null);
    setPausing(true);
    try {
      // Parse as end-of-day in local timezone to avoid UTC midnight rejection
      const pausedUntilIso = new Date(pauseDate + "T23:59:59").toISOString();
      await onPause(pausedUntilIso, pauseReason);
      setShowPauseForm(false);
      setPauseDate("");
      setPauseReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to pause");
    } finally {
      setPausing(false);
    }
  }

  async function handleResume() {
    setActionError(null);
    setResuming(true);
    try {
      await onResume();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to resume");
    } finally {
      setResuming(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border border-border bg-card/50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">
            {initial ? "Edit Hours" : "Set Hours"} — {shopName}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Pause banner */}
        {isPaused && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-400">Hours paused</p>
              {initial?.pause_reason && (
                <p className="text-xs text-amber-400/70 mt-0.5">{initial.pause_reason}</p>
              )}
              <p className="text-xs text-amber-400/70 mt-0.5">
                Until {new Date(initial!.paused_until!).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResume}
              disabled={resuming}
              className="border-amber-800 text-amber-400 hover:bg-amber-950 shrink-0"
            >
              <PlayCircle className="h-3.5 w-3.5 mr-1" />
              {resuming ? "Resuming…" : "Resume"}
            </Button>
          </div>
        )}

        {/* Timezone */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all duration-150"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {/* Weekly hours */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Weekly hours</p>
          <WeeklyGrid hours={weeklyHours} onChange={setWeeklyHours} />
        </div>

        {/* Device overrides */}
        {devices.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Device overrides
              <span className="ml-1 text-muted-foreground/50">
                (optional — overrides shop default for individual devices)
              </span>
            </p>
            <div className="space-y-2">
              {devices.map(({ micId, label }) => {
                const hasOverride = !!deviceOverrides[micId];
                const isExpanded = expandedDeviceId === micId;
                return (
                  <div
                    key={micId}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleDeviceOverride(micId, label)}
                          className={cn(
                            "w-8 h-4 rounded-full transition-colors relative shrink-0",
                            hasOverride ? "bg-primary" : "bg-muted"
                          )}
                          aria-label={`Toggle custom hours for ${label}`}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform shadow-sm",
                              hasOverride ? "left-[18px]" : "left-0.5"
                            )}
                          />
                        </button>
                        <span className="text-sm text-foreground">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {hasOverride ? "Custom hours" : "Shop default"}
                        </span>
                      </div>
                      {hasOverride && (
                        <button
                          type="button"
                          onClick={() => setExpandedDeviceId(isExpanded ? null : micId)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                    <AnimatePresence initial={false}>
                      {hasOverride && isExpanded && (
                        <motion.div
                          key="device-hours"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-2 border-t border-border">
                            <WeeklyGrid
                              hours={deviceOverrides[micId].weekly_hours}
                              onChange={(h) => updateDeviceHours(micId, h)}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pause section */}
        {!isPaused && (
          <div className="border-t border-border pt-4">
            {showPauseForm ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-xs font-medium text-muted-foreground">Pause hours until</p>
                <div className="flex flex-wrap gap-3">
                  <Input
                    type="date"
                    value={pauseDate}
                    onChange={(e) => setPauseDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="h-8 w-44 text-xs"
                  />
                  <Input
                    type="text"
                    placeholder="Reason (optional)"
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    className="h-8 flex-1 min-w-40 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePause}
                    disabled={!pauseDate || pausing}
                    className="border-amber-800 text-amber-400 hover:bg-amber-950"
                  >
                    <PauseCircle className="h-3.5 w-3.5 mr-1" />
                    {pausing ? "Pausing…" : "Confirm Pause"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPauseForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPauseForm(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-400 transition-colors"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                Pause hours temporarily
              </button>
            )}
          </div>
        )}

        {/* Pause/Resume error */}
        {actionError && (
          <p className="text-xs text-red-400">{actionError}</p>
        )}

        {/* Save error */}
        {saveError && (
          <p className="text-xs text-red-400">{saveError}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Saving…" : "Save Hours"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

