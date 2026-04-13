"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, Shield, Users, TrendingUp, Plus, Loader2, ChevronRight, Gift, CalendarClock, Lock } from "lucide-react";
import { listTemplates, listJobs, apiFetch, normalizeCredits } from "@/lib/api";
import type { AnalysisTemplate, AnalysisJob } from "@/types/analysis";
import type { RawCreditsResponse } from "@/types/api";
import { useApi } from "@/hooks/use-api";
import { useSubscription } from "@/hooks/use-subscription";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisModal } from "@/components/dashboard/analysis-modal";
import { toast } from "sonner";

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_TEMPLATES: AnalysisTemplate[] = [
  { templateId: "tmpl_staff", name: "Staff Performance Review", category: "staff_performance", description: "Evaluate staff interactions, response times, and customer handling quality across shifts.", complexityMultiplier: 1.2, isBuiltin: true, companyId: "demo", icon: "" },
  { templateId: "tmpl_customer", name: "Customer Sentiment Analysis", category: "customer_interaction", description: "Analyze customer mood, complaints, and satisfaction signals from audio conversations.", complexityMultiplier: 1.0, isBuiltin: true, companyId: "demo", icon: "" },
  { templateId: "tmpl_compliance", name: "Compliance & Policy Audit", category: "compliance_policy", description: "Check for policy violations, inappropriate language, and regulatory compliance.", complexityMultiplier: 1.5, isBuiltin: true, companyId: "demo", icon: "" },
  { templateId: "tmpl_sales", name: "Sales Performance Tracker", category: "sales_revenue", description: "Track upselling attempts, payment confirmations, and revenue-related conversations.", complexityMultiplier: 1.0, isBuiltin: true, companyId: "demo", icon: "" },
];

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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  staff_performance: Users,
  customer_interaction: BarChart3,
  sales_revenue: TrendingUp,
  compliance_policy: Shield,
};

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

function costLabel(multiplier: number): string {
  if (multiplier <= 1) return "Standard";
  if (multiplier <= 1.3) return "Standard+";
  return "Premium";
}

export default function AnalysisPage() {
  const router = useRouter();
  const [showJobs, setShowJobs] = useState(JOBS_PER_PAGE);
  const { hasAnalysis, isLoading: subLoading } = useSubscription();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTemplate, setModalTemplate] = useState<AnalysisTemplate | null>(null);
  const [modalStep, setModalStep] = useState(0);

  // SWR: templates
  const { data: templates = [], isLoading: templatesLoading, error: templatesError, mutate: mutateAll } = useApi<AnalysisTemplate[]>(
    IS_DEMO ? null : "/_analysis_all",
    async () => listTemplates(),
    { fallbackData: IS_DEMO ? DEMO_TEMPLATES : undefined },
  );

  // SWR: jobs
  const { data: jobs = [], mutate: mutateJobs } = useApi<AnalysisJob[]>(
    IS_DEMO ? null : "/_analysis_jobs",
    async () => listJobs(),
    { fallbackData: IS_DEMO ? DEMO_JOBS : undefined },
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
  const loading = templatesLoading || subLoading;
  const error = templatesError?.message ?? "";

  function openModal(template?: AnalysisTemplate) {
    setModalTemplate(template ?? null);
    setModalStep(template ? 1 : 0);
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

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-3 flex items-center justify-between" role="alert">
          <p className="text-sm text-red-400">Unable to load analysis data</p>
          <Button variant="ghost" size="sm" onClick={() => mutateAll()} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
            Retry
          </Button>
        </div>
      )}

      {/* Trial banner */}
      {subState === "trialing" && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3">
          <Gift className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{(credits / 60).toFixed(1)}h trial hours remaining</p>
            {trialEndsAt && (
              <p className="text-xs text-muted-foreground">
                Trial ends {new Date(trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/usage">Top Up</Link>
          </Button>
        </div>
      )}

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

      {/* Template Grid */}
      {(hasAnalysis !== false || IS_DEMO) && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">Templates</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((t) => {
              const Icon = CATEGORY_ICONS[t.category] ?? BarChart3;
              return (
                <button
                  key={t.templateId}
                  onClick={() => openModal(t)}
                  className="rounded-xl border border-border bg-card/50 p-5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    {t.isBuiltin && (
                      <BadgeVariant variant="blue" className="text-xs">Built-in</BadgeVariant>
                    )}
                  </div>
                  <p className="font-medium text-foreground text-sm mb-1">{t.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{costLabel(t.complexityMultiplier)}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      {(hasAnalysis !== false || IS_DEMO) && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">Recent Jobs</h2>
          {jobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/30 p-10 text-center">
              <BarChart3 className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground/70">No analysis jobs yet</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Select a template above to get started</p>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Credits</th>
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
                          {job.actualCredits > 0 ? job.actualCredits : job.estimatedCredits}
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
        templates={templates}
        initialTemplate={modalTemplate}
        initialStep={modalStep}
        balance={credits}
      />
    </div>
  );
}
