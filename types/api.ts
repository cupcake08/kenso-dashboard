// Raw types matching Go backend JSON exactly (snake_case, unix timestamps)
// These are what apiFetch returns after unwrapping {"data": ...}

export interface RawDevice {
  mic_id: string;
  shop_id: string;
  label: string;
  location: string;
  status: "active" | "soft_deleted" | "pending";
  last_seen_unix: number;
}

export interface RawWindowSummary {
  window_id: string;
  started_at_unix: number;
  duration_ms: number;
  flag_count: number;
  status: "pending" | "analyzing" | "transcribed" | "ready" | "failed" | "expired";
}

export interface RawWindowDetail {
  window_id: string;
  started_at_unix: number;
  duration_ms: number;
  summary: string;
  flags: RawWindowFlag[];
  highlights: RawWindowHighlight[];
  utterances: RawWindowUtterance[];
}

export interface RawWindowFlag {
  flag_type: "conflict" | "complaint" | "odd_activity" | "loud_noise" | "policy_violation" | "business_insight";
  title: string;
  description?: string;
  severity: "info" | "warning" | "critical";
}

export interface RawWindowHighlight {
  type: "order" | "payment" | "inquiry" | "feedback" | "complaint" | "action";
  time: string;
  description: string;
}

export interface RawWindowUtterance {
  speaker: string;
  text: string;
  absolute_time_unix: number;
}

export interface RawCreditsResponse {
  balance: number;
  plan: string;
  subscription_state?: string;
  trial_ends_at_unix?: number;
  history: RawTransaction[];
}

export interface RawTransaction {
  id: string;
  type: "topup" | "analysis" | "expiry";
  amount: number;
  window_id?: string;
  description?: string;
  created_at_unix: number;
}

export interface RawPlanResponse {
  plan: string;
  billing_cycle: string;
  price_per_month: number;
}

export interface ListenTokenResponse {
  token: string;
  sfu_url: string;
  mic_id: string;
  expires_at_unix: number;
}

// Normalized types for UI consumption (ISO dates, semantic field names)

// Device represents a mic in the enterprise dashboard. Despite the field name
// "device_id", this holds the mic_id from the backend's /devices endpoint
// (which lists mics, not hardware devices). The hardware device_id is not
// exposed in the dashboard API.
export interface Device {
  device_id: string;
  shop_id: string;
  label: string;
  location: string;
  status: "online" | "offline" | "streaming" | "pending";
  last_seen_at: string;
}

export interface WindowSummary {
  window_id: string;
  started_at: string;
  duration_minutes: number;
  status: string;
  flag_count: number;
}

export interface WindowDetail {
  window_id: string;
  started_at: string;
  duration_minutes: number;
  summary: string;
  flags: WindowFlag[];
  highlights: WindowHighlight[];
  utterances: WindowUtterance[];
}

export interface WindowFlag {
  flag_type: string;
  title: string;
  description?: string;
  severity: "info" | "warning" | "critical";
}

export interface WindowHighlight {
  type: string;
  time: string;
  description: string;
}

export interface WindowUtterance {
  speaker: string;
  text: string;
  absolute_time: string;
}

export interface Transaction {
  id: string;
  type: "topup" | "analysis" | "expiry";
  amount: number;
  description: string;
  created_at: string;
}

export interface PlanResponse {
  plan: string;
  billing_cycle: string;
  price_per_month: number;
}

// GET /v2/dashboard/subscription-status
export interface RawSubscriptionStatus {
  state: string;
  in_grace_period: boolean;
  grace_days_remaining: number;
  hard_blocked: boolean;
  trial_ends_at_unix?: number;
  period_end_unix?: number;
}
