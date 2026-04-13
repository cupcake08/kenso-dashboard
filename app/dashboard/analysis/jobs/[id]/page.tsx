"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertTriangle, Info, CheckCircle2, Clock, BarChart3, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getJob, cancelJob } from "@/lib/api";
import type { AnalysisJob, AnalysisFinding, AnalysisHighlight } from "@/types/analysis";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_JOB: AnalysisJob = {
  jobId: "job_demo_001",
  companyId: "demo",
  templateId: "tmpl_staff",
  templateName: "Staff Performance Review",
  micIds: ["mic_lobby_01", "mic_counter_02"],
  timeRangeStart: new Date(Date.now() - 86400000).toISOString(),
  timeRangeEnd: new Date(Date.now() - 82800000).toISOString(),
  status: "completed",
  executionTier: "flex",
  estimatedCredits: 120,
  actualCredits: 115,
  chunkCount: 6,
  chunksCompleted: 6,
  cached: false,
  createdAt: new Date(Date.now() - 86400000).toISOString(),
  completedAt: new Date(Date.now() - 82800000).toISOString(),
  result: {
    summary: `Overall staff performance was satisfactory during the monitored shift (09:00–18:00). Staff at the front counter (Counter A) handled 34 customer interactions with an average response time of 12 seconds. Two instances of extended wait times (>60s) were observed during the noon rush (12:15–12:40).

The back-room staff maintained consistent activity throughout. One notable interaction at 14:22 showed excellent de-escalation of a customer complaint about billing — the staff member offered alternatives and resolved the issue within 3 minutes.

Areas for improvement: product knowledge around the new premium line was inconsistent, with 3 customer queries redirected to a manager. Upselling was attempted in only 8% of eligible transactions, below the 20% target.`,
    transcript: [],
    findings: [
      {
        absoluteTime: new Date(Date.now() - 86400000 + 36000).toISOString(), segmentId: "seg_2", offsetMs: 36000, category: "sales", severity: "info",
        title: "Successful upsell attempt",
        description: "Staff member successfully upsold customer from the 3,499 SoundMax 200 to the 4,999 Pro version by highlighting the discount and feature differences.",
        evidence: "Staff_1: The Pro is 4,999, normally 6,999. It has 40W output and waterproofing.",
      },
      {
        absoluteTime: new Date(Date.now() - 86400000 + 60000000).toISOString(), segmentId: "seg_5", offsetMs: 60000000, category: "complaint", severity: "warning",
        title: "Customer complaint about billing discrepancy",
        description: "A customer at Counter B raised concerns about being charged the MRP instead of the displayed offer price. Staff initially dismissed but then resolved after escalation.",
        evidence: "Customer: The board says 20% off but you charged full price. Staff_2: Let me check... yes you're right, sorry about that.",
      },
      {
        absoluteTime: new Date(Date.now() - 86400000 + 78000000).toISOString(), segmentId: "seg_7", offsetMs: 78000000, category: "policy_violation", severity: "critical",
        title: "Unauthorized discount given",
        description: "Staff member at Counter A gave a 15% discount without manager approval, exceeding the 10% threshold defined in store policy.",
        evidence: "Staff_1: Don't worry, I'll give you 15% off. Customer: Thanks! Staff_1: Just between us.",
      },
    ],
    highlights: [
      { absoluteTime: new Date(Date.now() - 86400000 + 5000).toISOString(), segmentId: "seg_1", offsetMs: 5000, type: "inquiry", description: "Customer inquired about wireless speakers under ₹5,000" },
      { absoluteTime: new Date(Date.now() - 86400000 + 53000).toISOString(), segmentId: "seg_2", offsetMs: 53000, type: "payment", description: "UPI payment processed for SoundMax Pro (₹4,999)" },
      { absoluteTime: new Date(Date.now() - 86400000 + 36000).toISOString(), segmentId: "seg_2", offsetMs: 36000, type: "action", description: "Staff attempted upsell from base to Pro model" },
      { absoluteTime: new Date(Date.now() - 86400000 + 66000).toISOString(), segmentId: "seg_3", offsetMs: 66000, type: "feedback", description: "Customer expressed satisfaction with purchase experience" },
    ],
    recommendations: [
      "Conduct product knowledge training for the new premium line — 3 customer queries were redirected to a manager.",
      "Set up upselling reminder prompts at the POS to improve the current 8% attempt rate toward the 20% target.",
      "Review discount authorization flow — consider mobile approval to reduce wait time for customers needing >10% discounts.",
      "Add staffing during noon rush (12:00–13:00) to reduce the observed >60s wait times.",
    ],
    speakerBreakdown: { Staff_1: 0.45, Customer: 0.30, Staff_2: 0.15, Customer_2: 0.10 },
  },
};

const STATUS_COLORS: Record<string, string> = {
  completed: "emerald",
  failed: "red",
  processing: "blue",
  reserved: "blue",
  deducted: "blue",
  downloading: "blue",
  queued: "amber",
  chunking: "blue",
  synthesizing: "blue",
  pending: "amber",
  estimating: "amber",
  cancelled: "slate",
  refunded: "slate",
};

const SEVERITY_CONFIG = {
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: AlertTriangle },
  warning: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: AlertTriangle },
  info: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: Info },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function friendlyFailureReason(reason: string): string {
  if (reason.includes("MAX_TOKENS") || reason.includes("truncated"))
    return "The analysis produced too much output. Try selecting a shorter time range (under 30 minutes).";
  if (reason.includes("no_audio_in_range"))
    return "No audio recordings found in the selected time range. The device may have been offline.";
  if (reason.includes("insufficient credits") || reason.includes("credit reserve"))
    return "Not enough credits to run this analysis. Please top up your balance.";
  if (reason.includes("timeout") || reason.includes("stuck in"))
    return "The analysis timed out. This can happen with very large audio files. Please try again.";
  if (reason.includes("all chunks failed"))
    return "The analysis could not be completed. Please try again later.";
  if (reason.includes("rate limit") || reason.includes("RESOURCE_EXHAUSTED"))
    return "Our AI provider is temporarily overloaded. Please try again in a few minutes.";
  if (reason.includes("temporarily unavailable"))
    return "Our AI provider is temporarily unavailable. Your job has been queued and will retry automatically.";
  return "Something went wrong during analysis. Please try again, or contact support if this persists.";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FindingCard({ finding }: { finding: AnalysisFinding }) {
  const cfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={cn("rounded-lg border p-4", cfg.bg)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", cfg.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-sm font-medium", cfg.color)}>{finding.title}</span>
            <span className="text-xs text-muted-foreground">{formatTime(finding.absoluteTime)}</span>
            <BadgeVariant variant="slate" className="text-xs capitalize">{finding.category}</BadgeVariant>
          </div>
          <p className="mt-1 text-sm text-foreground">{finding.description}</p>
          {finding.evidence && (
            <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{finding.evidence}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightRow({ highlight }: { highlight: AnalysisHighlight }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-mono text-muted-foreground w-20 flex-shrink-0 pt-0.5">
        {formatTime(highlight.absoluteTime)}
      </span>
      <BadgeVariant variant="blue" className="text-xs capitalize flex-shrink-0">{highlight.type}</BadgeVariant>
      <p className="text-sm text-foreground">{highlight.description}</p>
    </div>
  );
}

type Tab = "summary" | "findings" | "highlights";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const [cancelling, setCancelling] = useState(false);
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(0);

  // Cancel countdown timer (60s window)
  useEffect(() => {
    if (!job) return;
    const terminal = ["completed", "failed", "cancelled", "refunded"];
    if (terminal.includes(job.status)) { setCancelSecondsLeft(0); return; }
    const elapsed = (Date.now() - new Date(job.createdAt).getTime()) / 1000;
    const remaining = Math.max(0, 60 - elapsed);
    if (remaining <= 0) { setCancelSecondsLeft(0); return; }
    setCancelSecondsLeft(Math.ceil(remaining));
    const interval = setInterval(() => {
      setCancelSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [job]);

  // SSE for live status updates
  useEffect(() => {
    if (IS_DEMO || !job) return;
    const terminal = ["completed", "failed", "cancelled", "refunded"];
    if (terminal.includes(job.status)) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
    let source: EventSource | null = null;

    // Get Firebase token for SSE auth (EventSource can't send headers, use query param)
    import("firebase/auth").then(async ({ getIdToken }) => {
      const { auth } = await import("@/lib/firebase");
      const user = auth?.currentUser;
      if (!user) return;
      const token = await getIdToken(user);
      const url = `${API_BASE}/v2/dashboard/analysis/jobs/${id}/events?token=${encodeURIComponent(token)}`;
      source = new EventSource(url);

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status && data.status !== job.status) {
            getJob(id).then(setJob).catch(() => {});
            if (data.status === "completed") {
              toast.success("Analysis complete");
              source?.close();
            } else if (data.status === "failed") {
              toast.error("Analysis failed");
              source?.close();
            }
          }
        } catch { /* ignore */ }
      };
    });

    return () => { source?.close(); };
  }, [id, job?.status]);

  // Initial load + polling fallback
  useEffect(() => {
    if (IS_DEMO) {
      setJob(DEMO_JOB);
      setLoading(false);
      return;
    }
    let interval: ReturnType<typeof setInterval> | null = null;

    function load() {
      getJob(id)
        .then((j) => {
          setJob(j);
          const inProgress = ["pending", "estimating", "deducted", "downloading", "processing"].includes(j.status);
          if (!inProgress && interval) {
            clearInterval(interval);
            interval = null;
          }
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }

    load();
    interval = setInterval(load, 10000);
    return () => { if (interval) clearInterval(interval); };
  }, [id]);

  async function handleCancel() {
    if (!job || cancelSecondsLeft <= 0) return;
    setCancelling(true);
    try {
      await cancelJob(id);
      setJob({ ...job, status: "cancelled" });
      toast.success("Analysis cancelled");
    } catch {
      // ignore
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <p className="text-sm text-red-400">{error || "Job not found"}</p>
      </div>
    );
  }

  const isInProgress = ["pending", "estimating", "deducted", "downloading", "processing", "chunking", "synthesizing"].includes(job.status);
  const result = job.result;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "summary", label: "Summary" },
    { key: "findings", label: "Findings", count: result?.findings.length },
    { key: "highlights", label: "Highlights", count: result?.highlights.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/analysis")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{job.templateName}</h1>
            <BadgeVariant variant={(STATUS_COLORS[job.status] as "emerald") ?? "slate"} className="capitalize">
              {job.status}
            </BadgeVariant>
            {job.cached && <BadgeVariant variant="slate">Cached</BadgeVariant>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(job.timeRangeStart).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} –{" "}
            {new Date(job.timeRangeEnd).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
          </p>
        </div>
        {isInProgress && (
          <div className="flex items-center gap-3">
            {job.status === "queued" ? (
              <span className="text-xs text-amber-400 max-w-[200px]">AI provider delayed — queued automatically</span>
            ) : job.chunkCount > 0 ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {job.chunksCompleted}/{job.chunkCount} chunks
              </span>
            ) : null}
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {cancelSecondsLeft > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
                className="text-muted-foreground hover:text-red-400 hover:border-red-400/30 tabular-nums"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Cancel ({cancelSecondsLeft}s)
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Credits used", value: job.status === "refunded" ? "Refunded" : job.actualCredits > 0 ? job.actualCredits : `~${job.estimatedCredits}` },
          { label: "Execution tier", value: job.executionTier },
          { label: "Devices", value: job.micIds.length },
          { label: "Created", value: formatDateTime(job.createdAt) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-sm font-medium text-foreground capitalize">{value}</p>
          </div>
        ))}
      </div>

      {job.failureReason && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{friendlyFailureReason(job.failureReason)}</p>
          {job.status === "refunded" && (
            <p className="text-xs text-muted-foreground mt-1">Credits have been refunded to your account.</p>
          )}
        </div>
      )}

      {/* Result tabs */}
      {result && (
        <>
          <div className="flex gap-1 rounded-lg bg-muted p-1 border border-border w-fit">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  tab === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}{count !== undefined && count > 0 ? ` (${count})` : ""}
              </button>
            ))}
          </div>

          {tab === "summary" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card/50 p-5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Summary</h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{result.summary}</p>
              </div>
              {result.recommendations.length > 0 && (
                <div className="rounded-xl border border-border bg-card/50 p-5">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.speakerBreakdown && Object.keys(result.speakerBreakdown).length > 0 && (
                <div className="rounded-xl border border-border bg-card/50 p-5">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Speaker Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(result.speakerBreakdown).map(([speaker, pct]) => (
                      <div key={speaker} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-20">{speaker}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.round(pct * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "findings" && (
            <div className="space-y-3">
              {result.findings.length === 0 ? (
                <div className="rounded-xl border border-border p-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No findings — everything looks normal.</p>
                </div>
              ) : (
                result.findings.map((f, i) => <FindingCard key={i} finding={f} />)
              )}
            </div>
          )}

          {tab === "highlights" && (
            <div className="rounded-xl border border-border bg-card/50 divide-y divide-border">
              {result.highlights.length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No highlights found.</p>
                </div>
              ) : (
                result.highlights.map((h, i) => <HighlightRow key={i} highlight={h} />)
              )}
            </div>
          )}

        </>
      )}

      {!result && !isInProgress && (
        <div className="rounded-xl border border-border p-8 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No result data available.</p>
        </div>
      )}
    </div>
  );
}
