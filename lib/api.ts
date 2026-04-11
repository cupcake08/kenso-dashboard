import { auth } from "./firebase";
import type {
  RawDevice, RawWindowSummary, RawWindowDetail, RawCreditsResponse,
  RawSubscriptionStatus, Device, WindowSummary, WindowDetail, Transaction,
} from "@/types/api";
import type {
  RawAnalysisTemplate, RawAnalysisJob, RawEstimateResponse, RawAnalysisSchedule,
  AnalysisTemplate, AnalysisJob, EstimateResult, AnalysisSchedule,
  OperatingSchedule, DaySchedule, DeviceOverride,
} from "@/types/analysis";

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

// Enterprise API — Firebase auth, unwraps {"data": ...} envelope
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

// --- Enterprise onboarding ---

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

// --- Response normalizers (backend snake_case/unix → UI-friendly shapes) ---

function unixToISO(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

function mapDeviceStatus(status: string): Device["status"] {
  if (status === "active") return "online";
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
  subscriptionState?: string;
  trialEndsAt?: string;
  transactions: Transaction[];
} {
  return {
    balance: raw.balance,
    subscriptionState: raw.subscription_state,
    trialEndsAt: raw.trial_ends_at_unix ? unixToISO(raw.trial_ends_at_unix) : undefined,
    transactions: raw.history.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description ?? "",
      created_at: unixToISO(t.created_at_unix),
    })),
  };
}

// --- Analysis API ---

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

export function normalizeJob(raw: RawAnalysisJob): AnalysisJob {
  return {
    jobId: raw.job_id,
    companyId: raw.company_id,
    templateId: raw.template_id,
    templateName: raw.template_name,
    micIds: raw.mic_ids,
    timeRangeStart: unixToISO(raw.time_range_start_unix),
    timeRangeEnd: unixToISO(raw.time_range_end_unix),
    status: raw.status,
    executionTier: raw.execution_tier,
    estimatedCredits: raw.estimated_credits,
    actualCredits: raw.actual_credits,
    chunkCount: raw.chunk_count,
    chunksCompleted: raw.chunks_completed,
    cached: raw.cached,
    failureReason: raw.failure_reason,
    result: raw.result
      ? {
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
          })),
          highlights: (raw.result.highlights ?? []).map((h) => ({
            absoluteTime: h.absolute_time,
            segmentId: h.segment_id,
            offsetMs: h.offset_ms,
            type: h.type,
            description: h.description,
          })),
          recommendations: raw.result.recommendations ?? [],
          metrics: raw.result.metrics,
          speakerBreakdown: raw.result.speaker_breakdown,
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
    runCount: raw.run_count,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export async function listTemplates(): Promise<AnalysisTemplate[]> {
  const raw = await apiFetch<RawAnalysisTemplate[]>("/analysis/templates");
  return raw.map(normalizeTemplate);
}

export async function createJob(body: {
  template_id: string;
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
  const raw = await apiFetch<RawAnalysisJob[]>(`/analysis/jobs?limit=${limit}`);
  return raw.map(normalizeJob);
}

export async function getJob(jobId: string): Promise<AnalysisJob> {
  const raw = await apiFetch<RawAnalysisJob>(`/analysis/jobs/${jobId}`);
  return normalizeJob(raw);
}

export async function cancelJob(jobId: string): Promise<void> {
  await apiFetch(`/analysis/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function estimateCredits(body: {
  template_id: string;
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
  };
}

export async function listSchedules(): Promise<AnalysisSchedule[]> {
  const raw = await apiFetch<RawAnalysisSchedule[]>("/analysis/schedules");
  return raw.map(normalizeSchedule);
}

export async function generateAPIKey(): Promise<string> {
  const res = await apiFetch<{ api_key: string }>("/settings/api-key", { method: "POST" });
  return res.api_key;
}

export async function rotateAPIKey(): Promise<string> {
  const res = await apiFetch<{ api_key: string }>("/settings/api-key/rotate", { method: "POST" });
  return res.api_key;
}

// --- Enterprise device management ---

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

// --- Operating Hours ---

export async function listOperatingHours(): Promise<OperatingSchedule[]> {
  return apiFetch<OperatingSchedule[]>("/operating-hours");
}

export async function getOperatingHours(shopId: string): Promise<OperatingSchedule> {
  return apiFetch<OperatingSchedule>(`/operating-hours/${shopId}`);
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

export async function deleteOperatingHours(shopId: string): Promise<void> {
  await apiFetch(`/operating-hours/${shopId}`, { method: "DELETE" });
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

// --- Schedule Management ---

export async function createSchedule(body: {
  template_id: string;
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
