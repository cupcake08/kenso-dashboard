import { auth } from "./firebase";
import type {
  RawDevice, RawWindowSummary, RawWindowDetail, RawCreditsResponse,
  RawSubscriptionStatus, Device, WindowSummary, WindowDetail, Transaction,
  UsageResponse,
} from "@/types/api";
import type {
  RawAnalysisTemplate, RawAnalysisJob, RawEstimateResponse, RawAnalysisSchedule,
  RawReference, RawRestaurantMetrics, RawTicketingMetrics, RawGenericMetrics,
  AnalysisTemplate, AnalysisJob, AnalysisResult, AnalysisResultV2, EstimateResult, AnalysisSchedule,
  OperatingSchedule, DaySchedule, DeviceOverride,
  Reference, RestaurantMetrics, TicketingMetrics, GenericMetrics, RawAnalysisResult,
  MicAnalysisResult, RawMicAnalysisResult,
} from "@/types/analysis";
import type {
  BusinessType, BusinessTypeState, BusinessTypeSuggestion, CompanyFeatures,
} from "@/types/company";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Not authenticated");
  const { getIdToken } = await import("firebase/auth");
  const token = await getIdToken(user);
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch<T>(
  path: string,
  opts?: RequestInit
): Promise<T> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/v2/dashboard${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `HTTP ${res.status}`;
    try {
      const err = JSON.parse(text);
      message = err?.error?.message || message;
    } catch { /* not JSON */ }
    throw new Error(message);
  }
  const text = await res.text();
  // 204 No Content or empty body → return undefined. Caller is responsible for
  // handling void-returning endpoints. Previously this returned `[] as T` which
  // silently returned an array for object-returning endpoints.
  if (!text) return undefined as T;
  const json = JSON.parse(text);
  // Go backend wraps all responses in {"data": ...}. Unwrap if present, otherwise
  // return the raw object. Do NOT fall back to `[]` — that was a type lie.
  return (json?.data ?? json) as T;
}

export async function entFetch<T>(
  path: string,
  opts?: RequestInit
): Promise<T> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `HTTP ${res.status}`;
    try {
      const err = JSON.parse(text);
      message = err?.error?.message || message;
    } catch { /* not JSON */ }
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return {} as T;
  const json = JSON.parse(text);
  return (json?.data ?? json ?? {}) as T;
}

export interface WhoamiResponse {
  uid: string;
  email: string;
  display_name: string;
  memberships: Array<{ company_id: string; role: string; status: string }>;
}

export async function whoami(): Promise<WhoamiResponse | null> {
  try {
    return await entFetch<WhoamiResponse>("/v2/enterprise/whoami");
  } catch {
    return null;
  }
}

export async function createCompany(name: string): Promise<{ company_id: string }> {
  return entFetch<{ company_id: string }>("/v2/enterprise/companies", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getSubscriptionStatus(): Promise<RawSubscriptionStatus | null> {
  try {
    return await apiFetch<RawSubscriptionStatus>("/subscription-status");
  } catch {
    return null;
  }
}

function unixToISO(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

function mapDeviceStatus(status: string): Device["status"] {
  if (status === "active") return "online";
  if (status === "inactive") return "offline";
  if (status === "soft_deleted") return "offline";
  if (status === "pending") return "pending";
  return "streaming";
}

export function normalizeDevice(raw: RawDevice): Device {
  return {
    device_id: raw.mic_id,
    shop_id: raw.shop_id,
    label: raw.label,
    location: raw.location,
    status: mapDeviceStatus(raw.status),
    last_seen_at: unixToISO(raw.last_seen_unix),
  };
}

export function normalizeWindow(raw: RawWindowSummary): WindowSummary {
  return {
    window_id: raw.window_id,
    started_at: unixToISO(raw.started_at_unix),
    duration_minutes: Math.round(raw.duration_ms / 60000),
    status: raw.status,
    flag_count: raw.flag_count,
  };
}

export function normalizeWindowDetail(raw: RawWindowDetail): WindowDetail {
  return {
    window_id: raw.window_id,
    started_at: unixToISO(raw.started_at_unix),
    duration_minutes: Math.round(raw.duration_ms / 60000),
    summary: raw.summary,
    flags: raw.flags,
    highlights: raw.highlights,
    utterances: raw.utterances.map((u) => ({
      speaker: u.speaker,
      text: u.text,
      absolute_time: unixToISO(u.absolute_time_unix),
    })),
  };
}

export function normalizeCredits(raw: RawCreditsResponse): {
  balance: number;
  balanceHours: number;
  subscriptionState?: string;
  trialEndsAt?: string;
  overageRatePerHourInr: number;
  transactions: Transaction[];
} {
  return {
    balance: raw.balance,
    balanceHours: raw.balance_hours ?? raw.balance / 60,
    subscriptionState: raw.subscription_state,
    trialEndsAt: raw.trial_ends_at_unix ? unixToISO(raw.trial_ends_at_unix) : undefined,
    overageRatePerHourInr: raw.overage_rate_per_hour_inr ?? 40,
    transactions: (raw.history ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description ?? "",
      created_at: unixToISO(t.created_at_unix),
    })),
  };
}

export function normalizeTemplate(raw: RawAnalysisTemplate): AnalysisTemplate {
  return {
    templateId: raw.template_id,
    name: raw.name,
    category: raw.category,
    description: raw.description,
    complexityMultiplier: raw.complexity_multiplier,
    isBuiltin: raw.is_builtin,
    companyId: raw.company_id,
    icon: raw.icon,
  };
}

function normalizeReference(raw: RawReference): Reference {
  return {
    absoluteTime: raw.absolute_time,
    segmentId: raw.segment_id,
    offsetMs: raw.offset_ms,
    durationMs: raw.duration_ms,
    spanText: raw.span_text,
    ...(raw.context != null && { context: raw.context }),
  };
}

function normalizeRestaurantMetrics(raw: RawRestaurantMetrics): RestaurantMetrics {
  return {
    ordersConfidence: raw.orders_confidence,
    ordersDetected: raw.orders_detected,
    upsellAttempts: raw.upsell_attempts,
    upsellSuccesses: raw.upsell_successes,
    upsellAttachRate: raw.upsell_attach_rate,
    avgWaitTimeSec: raw.avg_wait_time_sec,
    peakWaitTimeSec: raw.peak_wait_time_sec,
    complaintCount: raw.complaint_count,
    paymentEventsByMethod: raw.payment_events_by_method,
    topUpsellMoments: raw.top_upsell_moments.map((m) => ({
      staffPhrase: m.staff_phrase,
      itemAttached: m.item_attached,
      converted: m.converted,
      reference: normalizeReference(m.reference),
    })),
    complaintClusters: raw.complaint_clusters.map((c) => ({
      theme: c.theme,
      count: c.count,
      severity: c.severity,
      resolved: c.resolved,
      firstExample: normalizeReference(c.first_example),
    })),
  };
}

function normalizeGenericMetrics(raw: RawGenericMetrics): GenericMetrics {
  return {
    conversationCount: raw.conversation_count,
    avgConversationSec: raw.avg_conversation_sec,
    topics: raw.topics,
    ...(raw.classification_hint && {
      classificationHint: {
        vertical: raw.classification_hint.vertical as GenericMetrics["classificationHint"] extends { vertical: infer V } ? V : never,
        confidence: raw.classification_hint.confidence,
        reason: raw.classification_hint.reason,
      },
    }),
  };
}

function normalizeTicketingMetrics(raw: RawTicketingMetrics): TicketingMetrics {
  return {
    bookingsConfidence: raw.bookings_confidence,
    bookingsDetected: raw.bookings_detected,
    bookingsByChannel: raw.bookings_by_channel,
    avgHandlingTimeSec: raw.avg_handling_time_sec,
    peakQueueTimeSec: raw.peak_queue_time_sec,
    cancellationCount: raw.cancellation_count,
    noShowCount: raw.no_show_count,
    complaintCount: raw.complaint_count,
    paymentEventsByMethod: raw.payment_events_by_method,
    upsellAttempts: raw.upsell_attempts,
    upsellSuccesses: raw.upsell_successes,
    upsellAttachRate: raw.upsell_attach_rate,
    topUpsellMoments: raw.top_upsell_moments.map((m) => ({
      staffPhrase: m.staff_phrase,
      itemAttached: m.item_attached,
      converted: m.converted,
      reference: normalizeReference(m.reference),
    })),
    complaintClusters: raw.complaint_clusters.map((c) => ({
      theme: c.theme,
      count: c.count,
      severity: c.severity,
      resolved: c.resolved,
      firstExample: normalizeReference(c.first_example),
    })),
  };
}

export function normalizeJob(raw: RawAnalysisJob): AnalysisJob {
  return {
    jobId: raw.job_id,
    companyId: raw.company_id,
    templateId: raw.template_id,
    templateName: raw.template_name,
    micIds: raw.mic_ids,
    micNames: raw.mic_names,
    timeRangeStart: unixToISO(raw.time_range_start_unix),
    timeRangeEnd: unixToISO(raw.time_range_end_unix),
    status: raw.status,
    executionTier: raw.execution_tier,
    estimatedCredits: raw.estimated_credits,
    actualCredits: raw.actual_credits,
    chunkCount: raw.chunk_count,
    chunksCompleted: raw.chunks_completed,
    cached: raw.cached,
    micResultsAvailable: raw.mic_results_available ?? false,
    failureReason: raw.failure_reason,
    result: raw.result
      ? {
          // Legacy fields
          summary: raw.result.summary,
          transcript: (raw.result.transcript ?? []).map((u) => ({
            absoluteTime: u.absolute_time,
            segmentId: u.segment_id,
            offsetMs: u.offset_ms,
            durationMs: u.duration_ms,
            speaker: u.speaker,
            text: u.text,
          })),
          findings: (raw.result.findings ?? []).map((f) => ({
            absoluteTime: f.absolute_time,
            segmentId: f.segment_id,
            offsetMs: f.offset_ms,
            category: f.category,
            severity: f.severity,
            title: f.title,
            description: f.description,
            evidence: f.evidence,
            ...(f.evidence_ref && { evidenceRef: normalizeReference(f.evidence_ref) }),
          })),
          highlights: (raw.result.highlights ?? []).map((h) => ({
            absoluteTime: h.absolute_time,
            segmentId: h.segment_id,
            offsetMs: h.offset_ms,
            type: h.type,
            description: h.description,
            ...(h.reference && { reference: normalizeReference(h.reference) }),
          })),
          recommendations: raw.result.recommendations ?? [],
          metrics: raw.result.metrics,
          speakerBreakdown: raw.result.speaker_breakdown,

          // V2 identity
          ...(raw.result.vertical != null && { vertical: raw.result.vertical as "restaurant" | "ticketing" | "generic" | "" }),
          ...(raw.result.company_id && { companyId: raw.result.company_id }),
          ...(raw.result.shop_id && { shopId: raw.result.shop_id }),
          ...(raw.result.period && {
            period: {
              startUnix: raw.result.period.start_unix,
              endUnix: raw.result.period.end_unix,
              businessDay: raw.result.period.business_day,
              label: raw.result.period.label,
            },
          }),
          ...(raw.result.minutes_analyzed != null && { minutesAnalyzed: raw.result.minutes_analyzed }),
          ...(raw.result.prompt_version && { promptVersion: raw.result.prompt_version }),

          // V2 editorial
          ...(raw.result.lead_theme && { leadTheme: raw.result.lead_theme }),
          ...(raw.result.section_order && { sectionOrder: raw.result.section_order }),
          ...(raw.result.hero_quote && { heroQuote: normalizeReference(raw.result.hero_quote) }),

          // V2 sentiment
          ...(raw.result.sentiment && {
            sentiment: {
              bucketSeconds: raw.result.sentiment.bucket_seconds,
              values: raw.result.sentiment.values,
              average: raw.result.sentiment.average,
            },
          }),

          // V2 vertical extensions
          ...(raw.result.restaurant_metrics && {
            restaurantMetrics: normalizeRestaurantMetrics(raw.result.restaurant_metrics),
          }),
          ...(raw.result.ticketing_metrics && {
            ticketingMetrics: normalizeTicketingMetrics(raw.result.ticketing_metrics),
          }),
          ...(raw.result.generic_metrics && {
            genericMetrics: normalizeGenericMetrics(raw.result.generic_metrics),
          }),
        }
      : undefined,
    createdAt: unixToISO(raw.created_at_unix),
    completedAt: raw.completed_at_unix ? unixToISO(raw.completed_at_unix) : undefined,
  };
}

export function normalizeSchedule(raw: RawAnalysisSchedule): AnalysisSchedule {
  return {
    scheduleId: raw.schedule_id,
    companyId: raw.company_id,
    createdBy: raw.created_by,
    templateId: raw.template_id,
    templateName: raw.template_name,
    micIds: raw.mic_ids,
    shopIds: raw.shop_ids,
    scheduleType: raw.schedule_type,
    recurrenceRule: raw.recurrence_rule,
    analysisWindowHours: raw.analysis_window_hours,
    analysisStartTime: raw.analysis_start_time,
    analysisEndTime: raw.analysis_end_time,
    timezone: raw.timezone,
    freeTextNotes: raw.free_text_notes,
    enabled: raw.enabled ?? true,
    nextRunAt: raw.next_run_at,
    lastRunAt: raw.last_run_at,
    lastJobId: raw.last_job_id,
    pausedUntil: raw.paused_until,
    pauseReason: raw.pause_reason,
    consecutiveCreditFailures: raw.consecutive_credit_failures ?? 0,
    runCount: raw.run_count,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// Retained for future admin UI — no current caller in the dashboard.
// Templates are vestigial in the product flow (see engine.go DefaultTemplateID
// comment); this helper stays for an eventual template-management admin panel.
export async function listTemplates(): Promise<AnalysisTemplate[]> {
  // Go nil slices serialize to `null`, not `[]`. Guard before mapping.
  const raw = await apiFetch<RawAnalysisTemplate[] | null>("/analysis/templates");
  return (raw ?? []).map(normalizeTemplate);
}

export async function createJob(body: {
  template_id?: string;
  mic_ids: string[];
  shop_ids: string[];
  time_range_start_unix: number;
  time_range_end_unix: number;
  free_text_notes?: string;
}): Promise<AnalysisJob> {
  const raw = await apiFetch<RawAnalysisJob>("/analysis/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeJob(raw);
}

export async function listJobs(limit = 20): Promise<AnalysisJob[]> {
  const raw = await apiFetch<RawAnalysisJob[] | null>(`/analysis/jobs?limit=${limit}`);
  return (raw ?? []).map(normalizeJob);
}

export async function getJob(jobId: string): Promise<AnalysisJob> {
  const raw = await apiFetch<RawAnalysisJob>(`/analysis/jobs/${jobId}`);
  return normalizeJob(raw);
}

export async function cancelJob(jobId: string): Promise<void> {
  await apiFetch(`/analysis/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function getMicResults(jobId: string): Promise<MicAnalysisResult[]> {
  const raw = await apiFetch<RawMicAnalysisResult[] | null>(`/analysis/jobs/${jobId}/mic-results`);
  if (!raw) return [];
  return raw.map((r) => ({
    micId: r.mic_id,
    micName: r.mic_name,
    result: normalizeRawResult(r.result),
  }));
}

// normalizeRawResult converts a single RawAnalysisResult (snake_case from Go)
// into the normalized camelCase shape used by ReportShell / LegacyReport.
function normalizeRawResult(raw: RawAnalysisResult): AnalysisResult | AnalysisResultV2 {
  // Build the base normalized result with legacy fields.
  const normalized: Record<string, unknown> = {
    summary: raw.summary,
    transcript: (raw.transcript ?? []).map((u) => ({
      absoluteTime: u.absolute_time,
      segmentId: u.segment_id,
      offsetMs: u.offset_ms,
      durationMs: u.duration_ms,
      speaker: u.speaker,
      text: u.text,
    })),
    findings: (raw.findings ?? []).map((f) => ({
      absoluteTime: f.absolute_time,
      segmentId: f.segment_id,
      offsetMs: f.offset_ms,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      evidence: f.evidence,
      ...(f.evidence_ref && { evidenceRef: normalizeReference(f.evidence_ref) }),
    })),
    highlights: (raw.highlights ?? []).map((h) => ({
      absoluteTime: h.absolute_time,
      segmentId: h.segment_id,
      offsetMs: h.offset_ms,
      type: h.type,
      description: h.description,
      ...(h.reference && { reference: normalizeReference(h.reference) }),
    })),
    recommendations: raw.recommendations ?? [],
    metrics: raw.metrics,
    speakerBreakdown: raw.speaker_breakdown,
  };

  // V2 identity fields.
  if (raw.vertical != null) normalized.vertical = raw.vertical as "restaurant" | "ticketing" | "generic" | "";
  if (raw.company_id) normalized.companyId = raw.company_id;
  if (raw.shop_id) normalized.shopId = raw.shop_id;
  if (raw.period) {
    normalized.period = {
      startUnix: raw.period.start_unix,
      endUnix: raw.period.end_unix,
      businessDay: raw.period.business_day,
      label: raw.period.label,
    };
  }
  if (raw.minutes_analyzed != null) normalized.minutesAnalyzed = raw.minutes_analyzed;
  if (raw.prompt_version) normalized.promptVersion = raw.prompt_version;

  // V2 editorial.
  if (raw.lead_theme) normalized.leadTheme = raw.lead_theme;
  if (raw.section_order) normalized.sectionOrder = raw.section_order;
  if (raw.hero_quote) normalized.heroQuote = normalizeReference(raw.hero_quote);

  // V2 sentiment.
  if (raw.sentiment) {
    normalized.sentiment = {
      bucketSeconds: raw.sentiment.bucket_seconds,
      values: raw.sentiment.values,
      average: raw.sentiment.average,
    };
  }

  // V2 vertical extensions.
  if (raw.restaurant_metrics) {
    normalized.restaurantMetrics = normalizeRestaurantMetrics(raw.restaurant_metrics);
  }
  if (raw.ticketing_metrics) {
    normalized.ticketingMetrics = normalizeTicketingMetrics(raw.ticketing_metrics);
  }
  if (raw.generic_metrics) {
    normalized.genericMetrics = normalizeGenericMetrics(raw.generic_metrics);
  }

  return normalized as AnalysisResult | AnalysisResultV2;
}

export async function estimateCredits(body: {
  template_id?: string;
  mic_ids: string[];
  shop_ids: string[];
  time_range_start_unix: number;
  time_range_end_unix: number;
}): Promise<EstimateResult> {
  const raw = await apiFetch<RawEstimateResponse>("/analysis/estimate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    estimatedCredits: raw.estimated_credits,
    estimatedDurationMin: raw.estimated_duration_min,
    totalAudioDurationMs: raw.total_audio_duration_ms,
    hasAudio: raw.has_audio,
    estimatedHours: raw.estimated_hours ?? raw.estimated_credits / 60,
    estimatedCostInr: raw.estimated_cost_inr ?? Math.round(raw.estimated_credits / 60 * 40),
    ...(raw.per_mic_durations && {
      perMicDurations: raw.per_mic_durations.map((m) => ({
        micId: m.mic_id,
        durationMs: m.duration_ms,
      })),
    }),
  };
}

export async function listSchedules(): Promise<AnalysisSchedule[]> {
  const raw = await apiFetch<RawAnalysisSchedule[] | null>("/analysis/schedules");
  return (raw ?? []).map(normalizeSchedule);
}

export async function generateAPIKey(): Promise<string> {
  const res = await apiFetch<{ api_key: string }>("/settings/api-key", { method: "POST" });
  return res.api_key;
}

export async function rotateAPIKey(): Promise<string> {
  const res = await apiFetch<{ api_key: string }>("/settings/api-key/rotate", { method: "POST" });
  return res.api_key;
}

export async function enableMic(companyId: string, micId: string): Promise<unknown> {
  return entFetch(`/v2/enterprise/companies/${companyId}/mics/${micId}/enable`, {
    method: "PATCH",
    headers: { "X-Company-ID": companyId },
  });
}

export async function disableMic(companyId: string, micId: string): Promise<unknown> {
  return entFetch(`/v2/enterprise/companies/${companyId}/mics/${micId}/disable`, {
    method: "PATCH",
    headers: { "X-Company-ID": companyId },
  });
}

export async function listOperatingHours(): Promise<OperatingSchedule[]> {
  const raw = await apiFetch<OperatingSchedule[] | null>("/operating-hours");
  return raw ?? [];
}

export async function upsertOperatingHours(shopId: string, body: {
  timezone: string;
  weekly_hours: DaySchedule[];
  device_overrides?: Record<string, DeviceOverride>;
}): Promise<OperatingSchedule> {
  return apiFetch<OperatingSchedule>(`/operating-hours/${shopId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function pauseOperatingHours(shopId: string, pausedUntil: string, reason?: string): Promise<{ shop_id: string; status: string }> {
  return apiFetch<{ shop_id: string; status: string }>(`/operating-hours/${shopId}/pause`, {
    method: "PATCH",
    body: JSON.stringify({ paused_until: pausedUntil, reason }),
  });
}

export async function resumeOperatingHours(shopId: string): Promise<{ shop_id: string; status: string }> {
  return apiFetch<{ shop_id: string; status: string }>(`/operating-hours/${shopId}/resume`, {
    method: "PATCH",
  });
}

export async function createSchedule(body: {
  template_id?: string;
  mic_ids?: string[];
  shop_ids?: string[];
  schedule_type: string;
  recurrence_rule: string;
  analysis_window_hours?: number;
  analysis_start_time?: string;
  analysis_end_time?: string;
  timezone: string;
  free_text_notes?: string;
  next_run_unix: number;
}): Promise<{ schedule_id: string }> {
  return apiFetch("/analysis/schedules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function pauseSchedule(scheduleId: string, pausedUntil: string, reason?: string): Promise<void> {
  await apiFetch(`/analysis/schedules/${scheduleId}/pause`, {
    method: "PATCH",
    body: JSON.stringify({ paused_until: pausedUntil, reason }),
  });
}

export async function resumeSchedule(scheduleId: string): Promise<void> {
  await apiFetch(`/analysis/schedules/${scheduleId}/resume`, { method: "PATCH" });
}

export async function fetchUsage(): Promise<UsageResponse> {
  return apiFetch<UsageResponse>("/usage");
}

// ── Company / Business-Type endpoints ────────────────────────────────────────

export async function getBusinessType(): Promise<BusinessTypeState> {
  const raw = await apiFetch<{ business_type?: string; source?: string; set_at_unix?: number; description?: string }>(
    "/company/business-type"
  );
  return {
    businessType: (raw.business_type ?? "") as BusinessType,
    source: (raw.source ?? "") as BusinessTypeState["source"],
    setAtUnix: raw.set_at_unix,
    description: raw.description ?? "",
  };
}

export async function patchBusinessType(bt: BusinessType): Promise<void> {
  await apiFetch("/company/business-type", {
    method: "PATCH",
    body: JSON.stringify({ business_type: bt }),
  });
}

export async function getBusinessTypeSuggestion(): Promise<BusinessTypeSuggestion | null> {
  const raw = await apiFetch<{ suggestion?: { vertical: string; confidence: number; reason: string; created_at_unix?: number } | null }>(
    "/company/business-type/suggestion"
  );
  if (!raw?.suggestion) return null;
  const s = raw.suggestion;
  return {
    vertical: s.vertical as BusinessTypeSuggestion["vertical"],
    confidence: s.confidence,
    reason: s.reason,
    createdAtUnix: s.created_at_unix ?? 0,
  };
}

export async function confirmBusinessTypeSuggestion(): Promise<void> {
  await apiFetch("/company/business-type/suggestion/confirm", { method: "POST" });
}

export async function dismissBusinessTypeSuggestion(): Promise<void> {
  await apiFetch("/company/business-type/suggestion/dismiss", { method: "POST" });
}

export async function patchCompanyDescription(description: string): Promise<void> {
  await apiFetch("/company/description", {
    method: "PATCH",
    body: JSON.stringify({ description }),
  });
}

export async function getCompanyFeatures(): Promise<CompanyFeatures> {
  const raw = await apiFetch<CompanyFeatures | null>("/company/features");
  return raw ?? {};
}

// --- Admin endpoints ---
// Admin routes live under /v2/admin/ (not /v2/dashboard/admin/) — so they must
// go through entFetch (which takes a full path), not apiFetch (which prepends
// /v2/dashboard). Gated server-side by RequireAdminAPIKey.

export type AnalysisJobDebug = {
  job_id: string;
  prompt_version: string;
  model_name: string;
  duration_ms: number;
  token_usage: unknown;
  raw_gemini_response: string;
  system_prompt_text: string;
  user_prompt_text: string;
};

/**
 * Fetch admin debug view for an analysis job. Requires an admin API key — the
 * caller must ensure the request is authorized out-of-band (e.g. an admin-only
 * page with its own auth layer). This function does NOT inject the admin key;
 * callers add it via the `adminApiKey` parameter, which is attached as
 * `X-Admin-API-Key` to match the server's RequireAdminAPIKey middleware.
 */
export async function getAnalysisJobDebug(
  jobId: string,
  adminApiKey: string,
): Promise<AnalysisJobDebug> {
  return entFetch<AnalysisJobDebug>(
    `/v2/admin/analysis-jobs/${encodeURIComponent(jobId)}/debug`,
    { headers: { "X-Admin-API-Key": adminApiKey } },
  );
}
