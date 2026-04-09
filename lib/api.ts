import { auth } from "./firebase";
import type {
  RawDevice, RawWindowSummary, RawWindowDetail, RawCreditsResponse,
  Device, WindowSummary, WindowDetail, Transaction,
} from "@/types/api";

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
  const res = await fetch(`${API_BASE}/api/v2/dashboard${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const err = JSON.parse(text);
      throw new Error(err?.error?.message || text || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  const json = await res.json();
  // Go backend wraps all responses in {"data": ...}
  return (json.data ?? json) as T;
}

// --- Response normalizers (backend snake_case/unix → UI-friendly shapes) ---

function unixToISO(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

function mapDeviceStatus(status: string): Device["status"] {
  if (status === "active") return "online";
  if (status === "soft_deleted") return "offline";
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
  transactions: Transaction[];
} {
  return {
    balance: raw.balance,
    transactions: raw.history.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description ?? "",
      created_at: unixToISO(t.created_at_unix),
    })),
  };
}
