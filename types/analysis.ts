// Raw types matching Go backend JSON exactly (snake_case, unix timestamps)

export interface RawAnalysisTemplate {
  template_id: string;
  name: string;
  category: string;
  description: string;
  complexity_multiplier: number;
  is_builtin: boolean;
  company_id: string;
  icon: string;
  domain_persona?: string;
}

export interface RawAnalysisJob {
  job_id: string;
  company_id: string;
  template_id: string;
  template_name: string;
  mic_ids: string[];
  time_range_start_unix: number;
  time_range_end_unix: number;
  status: "pending" | "estimating" | "reserved" | "deducted" | "downloading" | "processing" | "chunking" | "synthesizing" | "queued" | "completed" | "failed" | "cancelled" | "refunded";
  execution_tier: "flex" | "standard" | "batch";
  estimated_credits: number;
  actual_credits: number;
  chunk_count: number;
  chunks_completed: number;
  cached: boolean;
  failure_reason?: string;
  result?: RawAnalysisResult;
  created_at_unix: number;
  completed_at_unix?: number;
}

export interface RawAnalysisResult {
  summary: string;
  transcript: RawAnalysisUtterance[];
  findings: RawAnalysisFinding[];
  highlights: RawAnalysisHighlight[];
  recommendations: string[];
  metrics?: Record<string, unknown>;
  speaker_breakdown?: Record<string, number>;
}

export interface RawAnalysisUtterance {
  absolute_time: string; // ISO string from Go time.Time
  segment_id: string;
  offset_ms: number;
  duration_ms: number;
  speaker: string;
  text: string;
}

export interface RawAnalysisFinding {
  absolute_time: string;
  segment_id: string;
  offset_ms: number;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  evidence?: string;
}

export interface RawAnalysisHighlight {
  absolute_time: string;
  segment_id: string;
  offset_ms: number;
  type: string;
  description: string;
}

export interface RawEstimateResponse {
  estimated_credits: number;
  estimated_duration_min: number;
  total_audio_duration_ms: number;
  has_audio: boolean;
}

export interface RawAnalysisSchedule {
  schedule_id: string;
  company_id: string;
  created_by: string;
  template_id: string;
  template_name: string;
  mic_ids: string[];
  shop_ids?: string[];
  schedule_type: "recurring" | "one_time";
  recurrence_rule: string;
  analysis_window_hours: number;
  analysis_start_time?: string;
  analysis_end_time?: string;
  timezone: string;
  free_text_notes?: string;
  enabled: boolean;
  next_run_at: string; // ISO string
  last_run_at?: string;
  last_job_id?: string;
  paused_until?: string;
  pause_reason?: string;
  run_count: number;
  created_at: string;
  updated_at: string;
}

// Normalized types for UI consumption

export interface AnalysisTemplate {
  templateId: string;
  name: string;
  category: string;
  description: string;
  complexityMultiplier: number;
  isBuiltin: boolean;
  companyId: string;
  icon: string;
}

export interface AnalysisJob {
  jobId: string;
  companyId: string;
  templateId: string;
  templateName: string;
  micIds: string[];
  timeRangeStart: string; // ISO
  timeRangeEnd: string;   // ISO
  status: RawAnalysisJob["status"];
  executionTier: "flex" | "standard" | "batch";
  estimatedCredits: number;
  actualCredits: number;
  chunkCount: number;
  chunksCompleted: number;
  cached: boolean;
  failureReason?: string;
  result?: AnalysisResult;
  createdAt: string; // ISO
  completedAt?: string; // ISO
}

export interface AnalysisResult {
  summary: string;
  transcript: AnalysisUtterance[];
  findings: AnalysisFinding[];
  highlights: AnalysisHighlight[];
  recommendations: string[];
  metrics?: Record<string, unknown>;
  speakerBreakdown?: Record<string, number>;
}

export interface AnalysisUtterance {
  absoluteTime: string; // ISO
  segmentId: string;
  offsetMs: number;
  durationMs: number;
  speaker: string;
  text: string;
}

export interface AnalysisFinding {
  absoluteTime: string;
  segmentId: string;
  offsetMs: number;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  evidence?: string;
}

export interface AnalysisHighlight {
  absoluteTime: string;
  segmentId: string;
  offsetMs: number;
  type: string;
  description: string;
}

export interface AnalysisSchedule {
  scheduleId: string;
  companyId?: string;
  createdBy?: string;
  templateId: string;
  templateName: string;
  micIds: string[];
  shopIds?: string[];
  scheduleType: "recurring" | "one_time";
  recurrenceRule: string;
  analysisWindowHours: number;
  analysisStartTime?: string;
  analysisEndTime?: string;
  timezone: string;
  freeTextNotes?: string;
  enabled: boolean;
  nextRunAt: string; // ISO
  lastRunAt?: string;
  lastJobId?: string;
  pausedUntil?: string;
  pauseReason?: string;
  runCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface EstimateResult {
  estimatedCredits: number;
  estimatedDurationMin: number;
  totalAudioDurationMs: number;
  hasAudio: boolean;
}

// --- Operating Hours ---

export interface DaySchedule {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface DeviceOverride {
  label: string;
  weekly_hours: DaySchedule[];
}

export interface OperatingSchedule {
  company_id: string;
  shop_id: string;
  timezone: string;
  weekly_hours: DaySchedule[];
  device_overrides: Record<string, DeviceOverride>;
  paused_until?: string;
  pause_reason?: string;
  created_at: string;
  updated_at: string;
}
