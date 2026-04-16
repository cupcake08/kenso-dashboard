"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, BarChart3, XCircle, Sparkles, TrendingUp, RotateCcw, Mail } from "lucide-react";
import { toast } from "sonner";
import { getJob, cancelJob, apiFetch, normalizeCredits, getAnalysisJobDebug, getMicResults } from "@/lib/api";
import { retryAnalysisJob, getAdminKey, hasAdminKey } from "@/lib/admin-api";
import type { AnalysisJob, AnalysisResult, AnalysisResultV2, MicAnalysisResult } from "@/types/analysis";
import type { RawCreditsResponse } from "@/types/api";
import { useApi } from "@/hooks/use-api";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Button } from "@/components/ui/button";
import { ReportShell } from "@/components/analysis-report/report-shell";
import { LegacyReport } from "@/components/analysis-report/legacy/legacy-report";
import { RecordingsPlayer } from "@/components/dashboard/recordings-player";

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

function friendlyFailureReason(reason: string, isTrial: boolean): string {
  if (reason.includes("MAX_TOKENS") || reason.includes("truncated"))
    return "The analysis produced too much output. Try selecting a shorter time range (under 30 minutes).";
  if (reason.includes("no_audio_in_range"))
    return "No audio recordings found in the selected time range. The device may have been offline.";
  if (reason.includes("insufficient credits") || reason.includes("credit reserve"))
    return isTrial
      ? "Not enough hours remaining to run this analysis. Upgrade to a paid plan to continue."
      : "Not enough hours remaining to run this analysis. Top up to continue.";
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

function isInsufficientCreditsReason(reason: string): boolean {
  return reason.includes("insufficient credits") || reason.includes("credit reserve");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Type guard: V2 results carry a `vertical` field; legacy shape does not. */
function isV2(r: AnalysisResult | AnalysisResultV2): r is AnalysisResultV2 {
  return r != null && "vertical" in r;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(0);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [retrying, setRetrying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [micResultsCache, setMicResultsCache] = useState<Record<string, MicAnalysisResult>>({});
  const [loadingMicResult, setLoadingMicResult] = useState(false);
  const [viewingMicId, setViewingMicId] = useState<string | null>(null);

  // Admin key from localStorage (developer-only features)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsAdmin(hasAdminKey());
    const handler = () => setIsAdmin(hasAdminKey());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Subscription state — used to branch the failure-reason CTA between
  // Top-up (active) and Upgrade (trialing). Same SWR key as /usage so we
  // don't double-fetch when the user navigates between the two.
  const { data: credits } = useApi<ReturnType<typeof normalizeCredits>>(
    IS_DEMO ? null : "/credits",
    async (url) => normalizeCredits(await apiFetch<RawCreditsResponse>(url)),
  );
  const isTrial = credits?.subscriptionState === "trialing" || credits?.subscriptionState === "trial_ended";

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

  // Initialize selectedMicId when job loads
  useEffect(() => {
    if (job && job.micIds.length > 0 && !selectedMicId) {
      setSelectedMicId(job.micIds[0]);
    }
  }, [job, selectedMicId]);

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

  async function handleRetry() {
    if (!job) return;
    setRetrying(true);
    try {
      const result = await retryAnalysisJob(job.jobId);
      toast.success(`New job created: ${result.new_job_id}`);
      router.push(`/dashboard/analysis/jobs/${result.new_job_id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  async function handleShareReport() {
    if (!job) return;
    setSharing(true);
    try {
      const debug = await getAnalysisJobDebug(job.jobId, getAdminKey());
      const subject = encodeURIComponent(`Analysis Job Failed: ${job.jobId}`);
      const body = encodeURIComponent(
        `Job ID: ${job.jobId}\n` +
        `Company: ${job.companyId}\n` +
        `Status: ${job.status}\n` +
        `Failure Reason: ${job.failureReason || "N/A"}\n` +
        `Model: ${debug.model_name}\n` +
        `Duration: ${debug.duration_ms}ms\n` +
        `Token Usage: ${JSON.stringify(debug.token_usage, null, 2)}\n` +
        `Prompt Version: ${debug.prompt_version}\n` +
        `Time Range: ${job.timeRangeStart} → ${job.timeRangeEnd}\n` +
        `Devices: ${job.micNames?.join(", ") || job.micIds.join(", ")}\n` +
        `Created: ${job.createdAt}\n\n` +
        `--- Raw Response (truncated) ---\n` +
        `${(debug.raw_gemini_response || "").slice(0, 2000)}`,
      );
      window.open(`mailto:admin@knownsense.ai?subject=${subject}&body=${body}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch debug info");
    } finally {
      setSharing(false);
    }
  }

  // Helper: get display name for a mic ID
  function micDisplayName(micId: string): string {
    if (!job) return micId;
    const idx = job.micIds.indexOf(micId);
    if (idx >= 0 && job.micNames && job.micNames[idx]) return job.micNames[idx];
    return micId;
  }

  // Fetch and display per-mic analysis result when a mic tab is clicked.
  async function handleMicTabClick(micId: string) {
    setSelectedMicId(micId);
    if (!job?.micResultsAvailable) return;

    if (micId === viewingMicId) {
      // Clicking same tab again → toggle back to overview.
      setViewingMicId(null);
      return;
    }

    // Check cache first.
    if (micResultsCache[micId]) {
      setViewingMicId(micId);
      return;
    }

    setLoadingMicResult(true);
    try {
      const results = await getMicResults(job.jobId);
      const cache: Record<string, MicAnalysisResult> = {};
      for (const r of results) {
        cache[r.micId] = r;
      }
      setMicResultsCache(cache);
      setViewingMicId(micId);
    } catch {
      toast.error("Failed to load per-mic results");
      setViewingMicId(null);
    } finally {
      setLoadingMicResult(false);
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
          <div className="flex items-center gap-3 flex-wrap">
            {/* Title is the time range — that's what identifies an analysis to
                the customer. Template name is omitted; vertical drives content. */}
            <h1 className="text-2xl font-bold text-foreground tabular-nums">
              {new Date(job.timeRangeStart).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
                timeZone: "Asia/Kolkata",
              })}
            </h1>
            <BadgeVariant variant={(STATUS_COLORS[job.status] as "emerald") ?? "slate"} className="capitalize">
              {job.status}
            </BadgeVariant>
            {job.cached && <BadgeVariant variant="slate">Cached</BadgeVariant>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {new Date(job.timeRangeStart).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })} –{" "}
            {new Date(job.timeRangeEnd).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}
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
        <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{friendlyFailureReason(job.failureReason, isTrial)}</p>
              {job.status === "refunded" && (
                <p className="text-xs text-muted-foreground mt-1">Credits have been refunded to your account.</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isInsufficientCreditsReason(job.failureReason) && (
                <Button
                  size="sm"
                  onClick={() => router.push(isTrial ? "/dashboard/usage?upgrade=1" : "/dashboard/usage")}
                  className="shrink-0"
                >
                  {isTrial ? (
                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Upgrade</>
                  ) : (
                    <><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Top up</>
                  )}
                </Button>
              )}
              {/* Admin-only buttons — visible only when admin API key is in localStorage */}
              {isAdmin && (job.status === "failed" || job.status === "refunded") && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={retrying}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    {retrying ? "Retrying..." : "Retry"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShareReport}
                    disabled={sharing}
                    className="text-xs"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    {sharing ? "Loading..." : "Report Issue"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mic tabs — switch between overview and per-mic results */}
      {job.micResultsAvailable && job.micIds.length > 1 && (
        <div className="flex gap-2">
          <button
            onClick={() => setViewingMicId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewingMicId === null
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent"
            }`}
          >
            Overview
          </button>
          {job.micIds.map((micId) => (
            <button
              key={micId}
              onClick={() => handleMicTabClick(micId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewingMicId === micId
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : selectedMicId === micId
                    ? "bg-muted/30 text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent"
              }`}
            >
              {loadingMicResult && viewingMicId === micId
                ? "Loading..."
                : micDisplayName(micId)}
            </button>
          ))}
        </div>
      )}

      {/* Result — dispatch to ReportShell (v2) or LegacyReport (pre-migration).
          When a mic tab is selected, show that mic's per-mic result. */}
      {(() => {
        const activeResult = viewingMicId && micResultsCache[viewingMicId]?.result
          ? micResultsCache[viewingMicId].result
          : result;
        if (!activeResult) return null;
        return isV2(activeResult)
          ? <ReportShell result={activeResult} />
          : <LegacyReport result={activeResult} />;
      })()}

      {/* Recordings player — allows playback of segments referenced in the report */}
      {selectedMicId && (
        <div id="recordings-player">
          <RecordingsPlayer deviceId={selectedMicId} />
        </div>
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
