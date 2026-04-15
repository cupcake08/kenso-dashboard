"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, Plus, Loader2, ChevronRight, Gift, CalendarClock, Lock, AlertCircle, Sparkles, TrendingUp } from "lucide-react";
import { listJobs, listSchedules, apiFetch, normalizeCredits } from "@/lib/api";
import type { AnalysisJob, AnalysisSchedule } from "@/types/analysis";
import { cronToDaysLabel } from "@/lib/cron";
import type { RawCreditsResponse } from "@/types/api";
import { useApi } from "@/hooks/use-api";
import { useSubscription } from "@/hooks/use-subscription";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisModal } from "@/components/dashboard/analysis-modal";
import { toast } from "sonner";

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";


const DEMO_JOBS: AnalysisJob[] = [
  {
    jobId: "job_demo_001", companyId: "demo", templateId: "tmpl_staff", templateName: "Staff Performance Review",
    micIds: ["mic_lobby_01", "mic_counter_02"], timeRangeStart: new Date(Date.now() - 86400000).toISOString(), timeRangeEnd: new Date(Date.now() - 82800000).toISOString(),
    status: "completed", executionTier: "flex", estimatedCredits: 120, actualCredits: 115, chunkCount: 6, chunksCompleted: 6, cached: false, createdAt: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date(Date.now() - 82800000).toISOString(),
  },
  {
    jobId: "job_demo_002", companyId: "demo", templateId: "tmpl_customer", templateName: "Customer Sentiment Analysis",
    micIds: ["mic_lobby_01"], timeRangeStart: new Date(Date.now() - 172800000).toISOString(), timeRangeEnd: new Date(Date.now() - 169200000).toISOString(),
    status: "processing", executionTier: "standard", estimatedCredits: 80, actualCredits: 0, chunkCount: 4, chunksCompleted: 2, cached: false, createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    jobId: "job_demo_003", companyId: "demo", templateId: "tmpl_compliance", templateName: "Compliance & Policy Audit",
    micIds: ["mic_counter_02", "mic_back_03"], timeRangeStart: new Date(Date.now() - 259200000).toISOString(), timeRangeEnd: new Date(Date.now() - 255600000).toISOString(),
    status: "failed", executionTier: "flex", estimatedCredits: 200, actualCredits: 0, chunkCount: 8, chunksCompleted: 3, cached: false, failureReason: "Gemini API rate limit exceeded — retry limit reached.", createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];


const STATUS_COLORS: Record<string, string> = {
  completed: "emerald", failed: "red", processing: "blue", deducted: "blue",
  downloading: "blue", chunking: "blue", synthesizing: "blue",
  pending: "amber", estimating: "amber", cancelled: "slate", refunded: "slate",
};

const JOBS_PER_PAGE = 10;

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${s.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} \u2013 ${e.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}


export default function AnalysisPage() {
  const router = useRouter();
  const [showJobs, setShowJobs] = useState(JOBS_PER_PAGE);
  const { hasAnalysis, isLoading: subLoading } = useSubscription();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  // SWR: jobs
  const { data: jobs = [], mutate: mutateJobs } = useApi<AnalysisJob[]>(
    IS_DEMO ? null : "/_analysis_jobs",
    async () => listJobs(),
    { fallbackData: IS_DEMO ? DEMO_JOBS : undefined },
  );

  // SWR: schedules — surfaced inline above Recent Jobs so customers see what's
  // recurring without bouncing to the dedicated /schedules page.
  const { data: schedules = [] } = useApi<AnalysisSchedule[]>(
    IS_DEMO ? null : "/_analysis_schedules",
    async () => listSchedules(),
    { fallbackData: IS_DEMO ? [] : undefined },
  );

  // SWR: credits — same cache key + return type as usage page so both share one cache entry
  const { data: creditsData } = useApi<ReturnType<typeof normalizeCredits>>(
    IS_DEMO ? null : "/credits",
    async (url) => normalizeCredits(await apiFetch<RawCreditsResponse>(url)),
    { fallbackData: IS_DEMO ? { balance: 24850, balanceHours: 414.2, subscriptionState: "trialing", trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(), overageRatePerHourInr: 40, transactions: [] } : undefined },
  );

  const credits = creditsData?.balance ?? 0;
  const subState = creditsData?.subscriptionState ?? "";
  const trialEndsAt = creditsData?.trialEndsAt ?? "";
  const loading = subLoading;

  function openModal() {
    setModalOpen(true);
  }

  function handleJobCreated(_job: AnalysisJob) {
    // Revalidate jobs list to pick up the new job
    mutateJobs();
  }

  const visibleJobs = jobs.slice(0, showJobs);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Run AI-powered analysis on your audio recordings</p>
        </div>
        {(hasAnalysis !== false || IS_DEMO) && (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/analysis/schedules">
                <CalendarClock className="h-4 w-4 mr-2" />
                Schedules
              </Link>
            </Button>
            <Button onClick={() => openModal()}>
              <Plus className="h-4 w-4 mr-2" />
              New Analysis
            </Button>
          </div>
        )}
      </div>

      {(() => {
        // Collapse the two banner decisions into one place so trial + credit-fail
        // callouts don't stack and compete for attention.
        const creditFails = jobs.filter(
          (j) => (j.status === "failed" || j.status === "refunded") &&
                 j.failureReason &&
                 (j.failureReason.includes("insufficient credits") ||
                  j.failureReason.includes("credit reserve")),
        );
        const needsUpgrade = subState === "trialing" || subState === "trial_ended";
        const showFailsCallout = creditFails.length > 0;

        return (
          <>
            {/* Trial banner — suppressed when the failed-credits callout is showing,
                to avoid two attention-claiming blocks telling the same story. */}
            {subState === "trialing" && !showFailsCallout && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3">
                <Gift className="h-5 w-5 text-primary shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Free trial — {(credits / 60).toFixed(1)}h of analysis available</p>
                  {trialEndsAt && (
                    <p className="text-xs text-muted-foreground">
                      Trial ends {new Date(trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/usage?upgrade=1">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                    Upgrade
                  </Link>
                </Button>
              </div>
            )}

            {/* Failed-due-to-credits callout — primary surface when there are
                failed scheduled analyses. Mobile-friendly wrap so the button
                doesn't crowd the text on a phone. */}
            {showFailsCallout && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-xl border border-red-400/30 bg-red-400/5 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {creditFails.length === 1
                        ? "1 analysis couldn't run — not enough hours"
                        : `${creditFails.length} analyses couldn't run — not enough hours`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {needsUpgrade
                        ? "Upgrade to a paid plan to continue."
                        : creditFails.length === 1
                          ? "Top up to unblock this analysis."
                          : "Top up to unblock scheduled analyses."}
                    </p>
                  </div>
                </div>
                <Button size="sm" asChild className="shrink-0 self-stretch sm:self-auto">
                  <Link href={needsUpgrade ? "/dashboard/usage?upgrade=1" : "/dashboard/usage"}>
                    {needsUpgrade ? (
                      <><Sparkles className="h-3.5 w-3.5 mr-1.5" aria-hidden />Upgrade</>
                    ) : (
                      <><TrendingUp className="h-3.5 w-3.5 mr-1.5" aria-hidden />Top up</>
                    )}
                  </Link>
                </Button>
              </div>
            )}
          </>
        );
      })()}

      {/* Listen-tier upgrade prompt (only when we know the tier, not on loading/error) */}
      {hasAnalysis === false && !IS_DEMO && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Lock className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-2">AI Analysis Not Available</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Your Listen plan includes recording and live monitoring. Upgrade to the Analyze plan to unlock AI-powered audio analysis.
          </p>
          <Button asChild>
            <Link href="/dashboard/usage">View Plans</Link>
          </Button>
        </div>
      )}

      {/* Schedules — compact inline preview, before Recent Jobs.
          Empty case: skipped entirely (schedules are an opt-in feature) so
          first-time customers don't see a dead-empty section. */}
      {(hasAnalysis !== false || IS_DEMO) && schedules.length > 0 && (() => {
        const visible = schedules.slice(0, 3);
        const more = schedules.length - visible.length;
        const formatNextRun = (iso: string): string => {
          const d = new Date(iso);
          const now = Date.now();
          const diffMs = d.getTime() - now;
          if (diffMs <= 0) return "due now";
          const diffH = diffMs / 3600000;
          if (diffH < 1) return `in ${Math.round(diffMs / 60000)} min`;
          if (diffH < 24) return `in ${Math.round(diffH)}h`;
          const diffD = Math.round(diffH / 24);
          return `in ${diffD}d`;
        };
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Schedules</h2>
              <Link
                href="/dashboard/analysis/schedules"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-card/30 divide-y divide-border/50 overflow-hidden">
              {visible.map((s) => {
                const isPaused = s.pausedUntil && new Date(s.pausedUntil).getTime() > Date.now();
                const cadence = s.scheduleType === "recurring"
                  ? cronToDaysLabel(s.recurrenceRule)
                  : "Once";
                const time = s.analysisStartTime || "";
                return (
                  <Link
                    key={s.scheduleId}
                    href={`/dashboard/analysis/schedules?id=${s.scheduleId}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors"
                  >
                    <CalendarClock className="h-4 w-4 text-muted-foreground/60 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.templateName || "Analysis"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {cadence}
                        {time && (<><span className="mx-1.5 text-muted-foreground/40">·</span>{time}</>)}
                        {s.analysisWindowHours > 0 && (
                          <><span className="mx-1.5 text-muted-foreground/40">·</span>{s.analysisWindowHours}h window</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isPaused ? (
                        <BadgeVariant variant="amber" className="text-xs">Paused</BadgeVariant>
                      ) : !s.enabled ? (
                        <BadgeVariant variant="slate" className="text-xs">Off</BadgeVariant>
                      ) : (
                        <span className="text-xs text-muted-foreground/70 tabular-nums">
                          Next {formatNextRun(s.nextRunAt)}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" aria-hidden />
                    </div>
                  </Link>
                );
              })}
              {more > 0 && (
                <Link
                  href="/dashboard/analysis/schedules"
                  className="block px-4 py-2.5 text-center text-xs text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors"
                >
                  +{more} more {more === 1 ? "schedule" : "schedules"}
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {/* Recent Jobs */}
      {(hasAnalysis !== false || IS_DEMO) && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">Recent Jobs</h2>
          {jobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/30 p-10 text-center">
              <BarChart3 className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground/70">No analysis jobs yet</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Click "New Analysis" above to run your first analysis</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/20">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Template</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Time Range</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hours</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {visibleJobs.map((job) => (
                      <tr
                        key={job.jobId}
                        className="hover:bg-muted/10 cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/analysis/jobs/${job.jobId}`)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/dashboard/analysis/jobs/${job.jobId}`); }}}
                        tabIndex={0}
                        role="link"
                        aria-label={`${job.templateName} — ${job.status}`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{job.templateName}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">
                          {formatTimeRange(job.timeRangeStart, job.timeRangeEnd)}
                        </td>
                        <td className="px-4 py-3">
                          <BadgeVariant variant={(STATUS_COLORS[job.status] as "emerald") ?? "slate"} className="capitalize text-xs">
                            {job.status}
                          </BadgeVariant>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                          {((job.actualCredits > 0 ? job.actualCredits : job.estimatedCredits) / 60).toFixed(1)}h
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="sm:hidden space-y-2">
                {visibleJobs.map((job) => (
                  <Link
                    key={job.jobId}
                    href={`/dashboard/analysis/jobs/${job.jobId}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{job.templateName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {formatTimeRange(job.timeRangeStart, job.timeRangeEnd)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <BadgeVariant variant={(STATUS_COLORS[job.status] as "emerald") ?? "slate"} className="capitalize text-xs">
                        {job.status}
                      </BadgeVariant>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {jobs.length > showJobs && (
                <div className="mt-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowJobs((s) => s + JOBS_PER_PAGE)} className="text-xs text-muted-foreground">
                    Show more ({jobs.length - showJobs} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal (extracted component) */}
      <AnalysisModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onJobCreated={handleJobCreated}
        balance={credits}
        subscriptionState={subState}
        onUpgrade={() => router.push("/dashboard/usage?upgrade=1")}
      />
    </div>
  );
}
