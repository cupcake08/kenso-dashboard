export interface Device {
  device_id: string;
  label: string;
  location: string;
  status: "online" | "offline" | "streaming";
  last_seen_at: string;
  shop_id: string;
}

export interface WindowSummary {
  window_id: string;
  started_at: string;
  duration_minutes: number;
  status: string;
  highlights: string[];
  flags_count: number;
  summary?: string;
}

export interface CreditBalance {
  balance: number;
  last_updated: string;
}

export interface Transaction {
  id: string;
  type: "topup" | "analysis" | "expiry";
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface PlanResponse {
  plan: string;
  billing_cycle: string;
  price_per_month: number;
}
