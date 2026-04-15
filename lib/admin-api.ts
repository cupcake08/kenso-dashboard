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

/* ── Webhook admin types ── */

export interface WebhookItem {
  webhook_id: string;
  url: string;
  secret_prefix: string;
  label: string;
  enabled: boolean;
  created_at_unix: number;
  created_by: string;
  consecutive_failures: number;
}

export interface CreateWebhookResponse {
  webhook_id: string;
  signing_secret: string;
  secret_prefix: string;
}

export interface DeliveryItem {
  delivery_id: string;
  event_id: string;
  event_type: string;
  status: string;
  attempts: number;
  last_response_status?: number;
  last_error?: string;
  created_at_unix: number;
  next_attempt_at_unix?: number;
}

/* ── Webhook admin functions ── */

export async function listWebhooks(cid: string): Promise<WebhookItem[]> {
  return adminFetch<WebhookItem[]>(`/v2/admin/companies/${cid}/webhooks`);
}

export async function createWebhook(cid: string, url: string, label: string): Promise<CreateWebhookResponse> {
  return adminFetch<CreateWebhookResponse>(`/v2/admin/companies/${cid}/webhooks`, {
    method: "POST",
    body: JSON.stringify({ url, label }),
  });
}

export async function updateWebhook(cid: string, webhookId: string, updates: { url?: string; label?: string; enabled?: boolean }): Promise<void> {
  await adminFetch(`/v2/admin/companies/${cid}/webhooks/${webhookId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteWebhook(cid: string, webhookId: string): Promise<void> {
  await adminFetch(`/v2/admin/companies/${cid}/webhooks/${webhookId}`, { method: "DELETE" });
}

export async function rotateWebhookSecret(cid: string, webhookId: string): Promise<CreateWebhookResponse> {
  return adminFetch<CreateWebhookResponse>(`/v2/admin/companies/${cid}/webhooks/${webhookId}/rotate-secret`, { method: "POST" });
}

export async function sendTestEvent(cid: string, webhookId: string): Promise<void> {
  await adminFetch(`/v2/admin/companies/${cid}/webhooks/${webhookId}/test`, { method: "POST" });
}

export async function listDeliveries(cid: string, webhookId: string): Promise<DeliveryItem[]> {
  return adminFetch<DeliveryItem[]>(`/v2/admin/companies/${cid}/webhooks/${webhookId}/deliveries`);
}

export async function getDelivery(deliveryId: string): Promise<Record<string, unknown>> {
  return adminFetch<Record<string, unknown>>(`/v2/admin/webhook-deliveries/${deliveryId}`);
}

export async function retryDelivery(deliveryId: string): Promise<void> {
  await adminFetch(`/v2/admin/webhook-deliveries/${deliveryId}/retry`, { method: "POST" });
}

export type RetryJobResponse = {
  original_job_id: string;
  new_job_id: string;
  status: string;
  created_at_unix: number;
};

export async function retryAnalysisJob(jobId: string): Promise<RetryJobResponse> {
  return adminFetch<RetryJobResponse>(
    `/v2/admin/analysis-jobs/${encodeURIComponent(jobId)}/retry`,
    { method: "POST" },
  );
}

export async function listAuditLog(cid: string): Promise<unknown[]> {
  return adminFetch<unknown[]>(`/v2/admin/companies/${cid}/api-audit-log`);
}
