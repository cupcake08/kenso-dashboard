"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, ArrowLeft, CalendarClock, Plus, Pencil, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { toast } from "sonner";
import { listSchedules, pauseSchedule, resumeSchedule, createSchedule, apiFetch } from "@/lib/api";
import { cronToHuman } from "@/lib/cron";
import type { AnalysisSchedule } from "@/types/analysis";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Button } from "@/components/ui/button";
import { ScheduleForm, type CreateSchedulePayload } from "@/components/dashboard/schedule-form";
import { cn } from "@/lib/utils";

// Re-render every 30s so "Next run" countdowns tick without a full refetch.
// Returns a Date.now() snapshot that live-updates.
function useCurrentTime(intervalMs: number = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_SCHEDULES: AnalysisSchedule[] = [
  {
    scheduleId: "sched_demo_01",
    templateId: "tmpl_staff",
    templateName: "Staff Performance Review",
    micIds: ["mic_lobby_01", "mic_counter_02"],
    shopIds: [],
    scheduleType: "recurring",
    recurrenceRule: "0 22 * * 1-6",
    analysisWindowHours: 9,
    analysisStartTime: "09:00",
    analysisEndTime: "18:00",
    timezone: "Asia/Kolkata",
    enabled: true,
    pausedUntil: undefined,
    pauseReason: undefined,
    nextRunAt: new Date(Date.now() + 86400000).toISOString(),
    lastRunAt: new Date(Date.now() - 86400000).toISOString(),
    runCount: 12,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    scheduleId: "sched_demo_02",
    templateId: "tmpl_compliance",
    templateName: "Compliance Audit",
    micIds: [],
    shopIds: ["shop_001", "shop_002"],
    scheduleType: "recurring",
    recurrenceRule: "0 8 * * 1,5",
    analysisWindowHours: 12,
    analysisStartTime: "08:00",
    analysisEndTime: "20:00",
    timezone: "Asia/Kolkata",
    enabled: true,
    pausedUntil: new Date(Date.now() + 4 * 86400000).toISOString(),
    pauseReason: "Diwali week",
    nextRunAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    runCount: 8,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

// cronToHuman is imported from @/lib/cron

// Returns a human-readable relative time string anchored on `now` so multiple
// calls during a single render tick stay consistent.
function formatRelative(iso: string | undefined, now: number): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - now;
  const diffMin = Math.round(diffMs / 60000);
  // Sub-minute: "Due now" reads better than "in 0m"
  if (diffMin === 0) return "Due now";
  if (Math.abs(diffMin) < 60) return diffMin > 0 ? `in ${diffMin}m` : `${-diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return diffH > 0 ? `in ${diffH}h` : `${-diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (Math.abs(diffD) < 7) return diffD > 0 ? `in ${diffD}d` : `${-diffD}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// True when the next run is within 5 minutes — used to highlight the row.
function isImminent(iso: string | undefined, now: number): boolean {
  if (!iso) return false;
  const diffMs = new Date(iso).getTime() - now;
  return diffMs > 0 && diffMs < 5 * 60_000;
}

function targetLabel(s: AnalysisSchedule): string {
  if (s.shopIds && s.shopIds.length > 0) {
    return `${s.shopIds.length} location${s.shopIds.length !== 1 ? "s" : ""}`;
  }
  return `${s.micIds.length} device${s.micIds.length !== 1 ? "s" : ""}`;
}

type PauseState = { scheduleId: string; date: string };

export default function SchedulesPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<AnalysisSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Show form: null = hidden, "new" = create, scheduleId = edit
  const [formMode, setFormMode] = useState<null | "new" | string>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  // Inline pause picker state
  const [pauseState, setPauseState] = useState<PauseState | null>(null);

  const loadSchedules = useCallback(() => {
    if (IS_DEMO) {
      setSchedules(DEMO_SCHEDULES);
      setLoading(false);
      return;
    }
    listSchedules()
      .then(setSchedules)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (IS_DEMO) { loadSchedules(); return; }
    let unsub: (() => void) | undefined;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      import("@/lib/firebase").then(({ auth }) => {
        if (!auth) { setLoading(false); return; }
        unsub = onAuthStateChanged(auth, (user: unknown) => {
          if (!user) { setLoading(false); return; }
          loadSchedules();
        });
      });
    });
    return () => unsub?.();
  }, [loadSchedules]);

  const editingSchedule = formMode && formMode !== "new"
    ? schedules.find((s) => s.scheduleId === formMode) ?? null
    : null;

  async function handleFormSubmit(data: CreateSchedulePayload) {
    if (IS_DEMO) {
      await new Promise((r) => setTimeout(r, 500));
      if (formMode === "new") {
        const tmplNames: Record<string, string> = {
          tmpl_staff: "Staff Performance Review",
          tmpl_compliance: "Compliance Audit",
          tmpl_customer: "Customer Sentiment Analysis",
          tmpl_sales: "Sales Performance Tracker",
        };
        const newSched: AnalysisSchedule = {
          scheduleId: `sched_demo_${Date.now()}`,
          templateId: data.template_id,
          templateName: tmplNames[data.template_id] ?? data.template_id,
          micIds: data.mic_ids ?? [],
          shopIds: data.shop_ids ?? [],
          scheduleType: data.schedule_type,
          recurrenceRule: data.recurrence_rule,
          analysisWindowHours: 9,
          analysisStartTime: data.analysis_start_time,
          analysisEndTime: data.analysis_end_time,
          timezone: data.timezone,
          freeTextNotes: data.free_text_notes,
          enabled: true,
          nextRunAt: new Date(data.next_run_unix * 1000).toISOString(),
          runCount: 0,
          createdAt: new Date().toISOString(),
        };
        setSchedules((prev) => [newSched, ...prev]);
      } else if (editingSchedule) {
        setSchedules((prev) =>
          prev.map((s) =>
            s.scheduleId === editingSchedule.scheduleId
              ? {
                  ...s,
                  templateId: data.template_id,
                  micIds: data.mic_ids ?? [],
                  shopIds: data.shop_ids ?? [],
                  scheduleType: data.schedule_type,
                  recurrenceRule: data.recurrence_rule,
                  analysisStartTime: data.analysis_start_time,
                  analysisEndTime: data.analysis_end_time,
                  timezone: data.timezone,
                  freeTextNotes: data.free_text_notes,
                  nextRunAt: new Date(data.next_run_unix * 1000).toISOString(),
                }
              : s
          )
        );
      }
      setFormMode(null);
      return;
    }

    if (formMode === "new") {
      await createSchedule({
        template_id: data.template_id,
        mic_ids: data.mic_ids,
        shop_ids: data.shop_ids,
        schedule_type: data.schedule_type,
        recurrence_rule: data.recurrence_rule,
        analysis_window_hours: data.analysis_window_hours,
        analysis_start_time: data.analysis_start_time,
        analysis_end_time: data.analysis_end_time,
        timezone: data.timezone,
        free_text_notes: data.free_text_notes,
        next_run_unix: data.next_run_unix,
      });
      loadSchedules();
    } else if (editingSchedule) {
      // Do NOT send template_id — backend UpdateSchedule does not accept it
      await apiFetch(`/analysis/schedules/${editingSchedule.scheduleId}`, {
        method: "PUT",
        body: JSON.stringify({
          mic_ids: data.mic_ids,
          shop_ids: data.shop_ids,
          schedule_type: data.schedule_type,
          recurrence_rule: data.recurrence_rule,
          analysis_window_hours: data.analysis_window_hours,
          analysis_start_time: data.analysis_start_time,
          analysis_end_time: data.analysis_end_time,
          timezone: data.timezone,
          free_text_notes: data.free_text_notes,
          next_run_unix: data.next_run_unix,
        }),
      });
      loadSchedules();
    }
    setFormMode(null);
  }

  async function handlePause(s: AnalysisSchedule) {
    if (!pauseState || pauseState.scheduleId !== s.scheduleId || !pauseState.date) return;
    setActionPending(s.scheduleId);
    try {
      // Parse as end-of-day in local timezone to avoid UTC midnight rejection
      const until = new Date(pauseState.date + "T23:59:59").toISOString();
      if (IS_DEMO) {
        await new Promise((r) => setTimeout(r, 400));
        setSchedules((prev) =>
          prev.map((x) =>
            x.scheduleId === s.scheduleId ? { ...x, pausedUntil: until } : x
          )
        );
      } else {
        await pauseSchedule(s.scheduleId, until);
        setSchedules((prev) =>
          prev.map((x) =>
            x.scheduleId === s.scheduleId ? { ...x, pausedUntil: until } : x
          )
        );
        toast.success("Schedule paused");
      }
      setPauseState(null);
    } catch (err) {
      toast.error("Couldn't pause schedule", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setActionPending(null);
    }
  }

  async function handleResume(s: AnalysisSchedule) {
    setActionPending(s.scheduleId);
    try {
      if (IS_DEMO) {
        await new Promise((r) => setTimeout(r, 400));
        setSchedules((prev) =>
          prev.map((x) =>
            x.scheduleId === s.scheduleId ? { ...x, pausedUntil: undefined, pauseReason: undefined } : x
          )
        );
      } else {
        await resumeSchedule(s.scheduleId);
        setSchedules((prev) =>
          prev.map((x) =>
            x.scheduleId === s.scheduleId ? { ...x, pausedUntil: undefined, pauseReason: undefined } : x
          )
        );
        toast.success("Schedule resumed");
      }
    } catch (err) {
      toast.error("Couldn't resume schedule", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setActionPending(null);
    }
  }

  async function handleDelete(s: AnalysisSchedule) {
    if (!confirm(`Delete schedule for "${s.templateName}"?`)) return;
    try {
      if (IS_DEMO) {
        setSchedules((prev) => prev.filter((x) => x.scheduleId !== s.scheduleId));
        return;
      }
      await apiFetch(`/analysis/schedules/${s.scheduleId}`, { method: "DELETE" });
      setSchedules((prev) => prev.filter((x) => x.scheduleId !== s.scheduleId));
    } catch {
      // ignore
    }
  }

  const now = useCurrentTime();
  const activeCount = schedules.filter(
    (s) => s.enabled && !(s.pausedUntil && new Date(s.pausedUntil) > new Date(now))
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/analysis")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Schedules</h1>
            {schedules.length > 0 && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {schedules.length} total
                {activeCount > 0 && activeCount !== schedules.length && (
                  <> · <span className="text-emerald-400">{activeCount} active</span></>
                )}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Recurring and one-time analysis schedules</p>
        </div>
        {formMode === null && (
          <Button onClick={() => setFormMode("new")}>
            <Plus className="h-4 w-4 mr-2" />
            New schedule
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Form (animated) */}
      <AnimatePresence>
        {formMode !== null && (
          <motion.div
            key={formMode}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <ScheduleForm
              initial={editingSchedule}
              onSubmit={handleFormSubmit}
              onCancel={() => setFormMode(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/30 px-6 py-12">
          <div className="mx-auto max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No schedules yet</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Automate analysis by running templates on a recurring schedule, or trigger a one-time analysis for a specific window.
            </p>
            {formMode === null && (
              <Button
                size="sm"
                className="mt-5"
                onClick={() => setFormMode("new")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create your first schedule
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <LayoutGroup>
          <div className="hidden sm:block rounded-xl border border-border overflow-hidden bg-card/30">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Template</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Target</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Schedule</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Next run</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Runs</th>
                  <th className="px-4 py-3 w-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schedules.map((s, idx) => {
                  const isPaused = !!s.pausedUntil && new Date(s.pausedUntil) > new Date(now);
                  const isPending = actionPending === s.scheduleId;
                  const showPausePicker = pauseState?.scheduleId === s.scheduleId;
                  const imminent = !isPaused && s.enabled && isImminent(s.nextRunAt, now);

                  return (
                    <motion.tr
                      key={s.scheduleId}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: idx * 0.04, ease: [0.25, 1, 0.5, 1] }}
                      className={cn(
                        "align-top transition-colors",
                        "hover:bg-muted/20",
                        imminent && "bg-emerald-950/10"
                      )}
                    >
                      <td className="px-4 py-4">
                        <p className="text-[0.9375rem] font-semibold tracking-tight text-foreground leading-tight">
                          {s.templateName}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {targetLabel(s)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-foreground leading-tight">
                          {cronToHuman(s.recurrenceRule)}
                        </p>
                        {s.analysisStartTime && s.analysisEndTime && (
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            {s.analysisStartTime}–{s.analysisEndTime}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {isPaused ? (
                          <div className="space-y-1">
                            <BadgeVariant variant="amber" className="text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                              Paused
                            </BadgeVariant>
                            {s.pauseReason && (
                              <p className="text-[11px] text-muted-foreground italic">{s.pauseReason}</p>
                            )}
                            <p className="text-[11px] tabular-nums text-muted-foreground">
                              until {new Date(s.pausedUntil!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                        ) : s.enabled ? (
                          <BadgeVariant variant="emerald" className="text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                            Active
                          </BadgeVariant>
                        ) : (
                          <BadgeVariant variant="slate" className="text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden />
                            Disabled
                          </BadgeVariant>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            imminent ? "font-semibold text-emerald-400" : "text-muted-foreground"
                          )}
                        >
                          {imminent && (
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                          )}
                          {formatRelative(s.nextRunAt, now)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={cn(
                          "text-sm tabular-nums",
                          s.runCount === 0 ? "text-muted-foreground/50" : "font-medium text-foreground"
                        )}>
                          {s.runCount === 0 ? "—" : s.runCount}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          {/* Edit */}
                          <button
                            onClick={() => setFormMode(formMode === s.scheduleId ? null : s.scheduleId)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Edit schedule"
                            aria-label="Edit schedule"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* Pause/Resume */}
                          {isPaused ? (
                            <button
                              onClick={() => handleResume(s)}
                              disabled={isPending}
                              className="p-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                              title="Resume schedule"
                              aria-label="Resume schedule"
                            >
                              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setPauseState(
                                  showPausePicker ? null : { scheduleId: s.scheduleId, date: "" }
                                )
                              }
                              disabled={isPending}
                              className={cn(
                                "p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                showPausePicker
                                  ? "text-amber-400 bg-amber-400/10"
                                  : "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"
                              )}
                              title="Pause schedule"
                              aria-label="Pause schedule"
                            >
                              <PauseCircle className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(s)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Delete schedule"
                            aria-label="Delete schedule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Inline pause date picker */}
                        <AnimatePresence>
                          {showPausePicker && (
                            <motion.div
                              key="pause-picker"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="date"
                                  className="flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  value={pauseState?.date ?? ""}
                                  onChange={(e) =>
                                    setPauseState((prev) => prev ? { ...prev, date: e.target.value } : null)
                                  }
                                  min={new Date().toISOString().split("T")[0]}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 px-2.5"
                                  disabled={!pauseState?.date || isPending}
                                  onClick={() => handlePause(s)}
                                >
                                  {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pause"}
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </LayoutGroup>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {schedules.map((s, idx) => {
              const isPaused = !!s.pausedUntil && new Date(s.pausedUntil) > new Date(now);
              const isPending = actionPending === s.scheduleId;
              const showPausePicker = pauseState?.scheduleId === s.scheduleId;
              const imminent = !isPaused && s.enabled && isImminent(s.nextRunAt, now);

              return (
                <motion.div
                  key={s.scheduleId}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: idx * 0.04, ease: [0.25, 1, 0.5, 1] }}
                  className={cn(
                    "rounded-xl border border-border bg-card/50 p-4 space-y-3",
                    imminent && "border-emerald-800/50 bg-emerald-950/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-semibold tracking-tight text-foreground truncate">{s.templateName}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{targetLabel(s)}</p>
                    </div>
                    {isPaused ? (
                      <BadgeVariant variant="amber" className="text-xs shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                        Paused
                      </BadgeVariant>
                    ) : s.enabled ? (
                      <BadgeVariant variant="emerald" className="text-xs shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                        Active
                      </BadgeVariant>
                    ) : (
                      <BadgeVariant variant="slate" className="text-xs shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden />
                        Disabled
                      </BadgeVariant>
                    )}
                  </div>

                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p className="text-foreground">{cronToHuman(s.recurrenceRule)}</p>
                    {s.analysisStartTime && s.analysisEndTime && (
                      <p className="tabular-nums">Window: {s.analysisStartTime}–{s.analysisEndTime}</p>
                    )}
                    <p className={cn("tabular-nums", imminent && "font-semibold text-emerald-400")}>
                      Next run: {formatRelative(s.nextRunAt, now)}
                    </p>
                    {isPaused && s.pauseReason && <p className="italic">Reason: {s.pauseReason}</p>}
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t border-border">
                    <button
                      onClick={() => setFormMode(formMode === s.scheduleId ? null : s.scheduleId)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />Edit
                    </button>

                    {isPaused ? (
                      <button
                        onClick={() => handleResume(s)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors ml-auto disabled:opacity-50"
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setPauseState(showPausePicker ? null : { scheduleId: s.scheduleId, date: "" })
                        }
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 transition-colors ml-auto"
                      >
                        <PauseCircle className="h-4 w-4" />Pause
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(s)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />Delete
                    </button>
                  </div>

                  <AnimatePresence>
                    {showPausePicker && (
                      <motion.div
                        key="pause-picker-mobile"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="date"
                            className="flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={pauseState?.date ?? ""}
                            onChange={(e) =>
                              setPauseState((prev) => prev ? { ...prev, date: e.target.value } : null)
                            }
                            min={new Date().toISOString().split("T")[0]}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2.5"
                            disabled={!pauseState?.date || isPending}
                            onClick={() => handlePause(s)}
                          >
                            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pause"}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
