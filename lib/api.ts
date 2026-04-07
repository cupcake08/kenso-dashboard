import { getIdToken } from "firebase/auth";
import { auth } from "./firebase";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
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
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
