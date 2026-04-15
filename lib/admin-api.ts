const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("admin-api-key") ?? "";
}

export function setAdminKey(key: string) {
  localStorage.setItem("admin-api-key", key);
}

export function hasAdminKey(): boolean {
  return !!getAdminKey();
}

export async function adminFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const key = getAdminKey();
  if (!key) throw new Error("Admin API key not set");

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-API-Key": key,
      ...opts?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Request failed: ${res.status}`);
  }

  const text = await res.text();
  if (!text) return {} as T;
  const json = JSON.parse(text);
  return json.data ?? json;
}

/* ── Enterprise API admin types ── */

export interface CompanyAPIStatus {
  api_enabled: boolean;
  company_id: string;
  company_name: string;
}

export interface APIKeyItem {
  key_hash: string;
  key_prefix: string;
  label: string;
  created_at_unix: number;
  created_by: string;
  last_used_at_unix?: number;
  revoked_at_unix?: number;
  revoke_reason?: string;
}

export interface GenerateKeyResponse {
  raw_key: string;
  key_prefix: string;
}

/* ── Enterprise API admin functions ── */

export async function getCompanyAPIStatus(cid: string): Promise<CompanyAPIStatus> {
  return adminFetch<CompanyAPIStatus>(`/v2/admin/companies/${cid}/api-enabled`);
}

export async function toggleCompanyAPI(cid: string, enabled: boolean, reason: string): Promise<{ api_enabled: boolean }> {
  return adminFetch<{ api_enabled: boolean }>(`/v2/admin/companies/${cid}/api-enabled`, {
    method: "PUT",
    body: JSON.stringify({ enabled, reason }),
  });
}

export async function listAPIKeys(cid: string): Promise<APIKeyItem[]> {
  return adminFetch<APIKeyItem[]>(`/v2/admin/companies/${cid}/api-keys`);
}

export async function generateAPIKey(cid: string, label: string): Promise<GenerateKeyResponse> {
  return adminFetch<GenerateKeyResponse>(`/v2/admin/companies/${cid}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function revokeAPIKey(cid: string, hash: string, reason: string): Promise<void> {
  await adminFetch(`/v2/admin/companies/${cid}/api-keys/${hash}/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
