"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, ArrowLeft, Calendar, Plus, Pencil, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { listSchedules, pauseSchedule, resumeSchedule, createSchedule, apiFetch } from "@/lib/api";
import { cronToHuman } from "@/lib/cron";
import type { AnalysisSchedule } from "@/types/analysis";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Button } from "@/components/ui/button";
import { ScheduleForm, type CreateSchedulePayload } from "@/components/dashboard/schedule-form";
import { cn } from "@/lib/utils";

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

function formatRelative(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return diffMin >= 0 ? `in ${diffMin}m` : `${-diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return diffH >= 0 ? `in ${diffH}h` : `${-diffH}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Schedules</h1>
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
        <div className="rounded-xl border border-border bg-card/50 p-10 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No schedules yet. Click &ldquo;New Schedule&rdquo; to create one.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Template</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Schedule</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Next run</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Runs</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schedules.map((s) => {
                  const isPaused = !!s.pausedUntil && new Date(s.pausedUntil) > new Date();
                  const isPending = actionPending === s.scheduleId;
                  const showPausePicker = pauseState?.scheduleId === s.scheduleId;

                  return (
                    <tr key={s.scheduleId} className="hover:bg-muted/20 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{s.templateName}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {targetLabel(s)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-foreground">{cronToHuman(s.recurrenceRule)}</p>
                        {s.analysisStartTime && s.analysisEndTime && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {s.analysisStartTime}–{s.analysisEndTime}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isPaused ? (
                          <div>
                            <BadgeVariant variant="amber" className="text-xs">Paused</BadgeVariant>
                            {s.pauseReason && (
                              <p className="text-xs text-muted-foreground mt-0.5">{s.pauseReason}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              until {new Date(s.pausedUntil!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                        ) : s.enabled ? (
                          <BadgeVariant variant="emerald" className="text-xs">Active</BadgeVariant>
                        ) : (
                          <BadgeVariant variant="slate" className="text-xs">Disabled</BadgeVariant>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">
                        {formatRelative(s.nextRunAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">
                        {s.runCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {/* Edit */}
                          <button
                            onClick={() => setFormMode(formMode === s.scheduleId ? null : s.scheduleId)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* Pause/Resume */}
                          {isPaused ? (
                            <button
                              onClick={() => handleResume(s)}
                              disabled={isPending}
                              className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors"
                              title="Resume"
                            >
                              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
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
                                "p-1.5 rounded-lg transition-colors",
                                showPausePicker
                                  ? "text-amber-400 bg-amber-400/10"
                                  : "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"
                              )}
                              title="Pause"
                            >
                              <PauseCircle className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(s)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Inline pause date picker */}
                        {showPausePicker && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="date"
                              className="flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {schedules.map((s) => {
              const isPaused = !!s.pausedUntil && new Date(s.pausedUntil) > new Date();
              const isPending = actionPending === s.scheduleId;
              const showPausePicker = pauseState?.scheduleId === s.scheduleId;

              return (
                <div key={s.scheduleId} className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{s.templateName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{targetLabel(s)}</p>
                    </div>
                    {isPaused ? (
                      <BadgeVariant variant="amber" className="text-xs shrink-0">Paused</BadgeVariant>
                    ) : s.enabled ? (
                      <BadgeVariant variant="emerald" className="text-xs shrink-0">Active</BadgeVariant>
                    ) : (
                      <BadgeVariant variant="slate" className="text-xs shrink-0">Disabled</BadgeVariant>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{cronToHuman(s.recurrenceRule)}</p>
                    {s.analysisStartTime && s.analysisEndTime && (
                      <p>Window: {s.analysisStartTime}–{s.analysisEndTime}</p>
                    )}
                    <p>Next run: {formatRelative(s.nextRunAt)}</p>
                    {isPaused && s.pauseReason && <p>Reason: {s.pauseReason}</p>}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    <button
                      onClick={() => setFormMode(formMode === s.scheduleId ? null : s.scheduleId)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />Edit
                    </button>

                    {isPaused ? (
                      <button
                        onClick={() => handleResume(s)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors ml-auto"
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setPauseState(showPausePicker ? null : { scheduleId: s.scheduleId, date: "" })
                        }
                        disabled={isPending}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-400 transition-colors ml-auto"
                      >
                        <PauseCircle className="h-3.5 w-3.5" />Pause
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(s)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />Delete
                    </button>
                  </div>

                  {showPausePicker && (
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="date"
                        className="flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
