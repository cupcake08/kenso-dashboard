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

  const json = await res.json();
  return json.data ?? json;
}
