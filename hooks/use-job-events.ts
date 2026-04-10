"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

/**
 * Subscribes to SSE events for a list of in-progress analysis job IDs.
 * Shows toast notifications when jobs complete or fail.
 * Auto-cleans up connections for completed jobs.
 */
export function useJobNotifications(
  jobIds: string[],
  getToken: () => Promise<string | null>,
  onJobCompleted?: (jobId: string) => void,
) {
  const sourcesRef = useRef<Map<string, EventSource>>(new Map());
  const tokenRef = useRef<string | null>(null);

  // Refresh token
  const refreshToken = useCallback(async () => {
    tokenRef.current = await getToken();
  }, [getToken]);

  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  useEffect(() => {
    // Close connections for jobs no longer in the list
    for (const [id, source] of sourcesRef.current) {
      if (!jobIds.includes(id)) {
        source.close();
        sourcesRef.current.delete(id);
      }
    }

    // Open connections for new job IDs
    for (const id of jobIds) {
      if (sourcesRef.current.has(id)) continue;

      const token = tokenRef.current;
      if (!token) continue;

      const url = `${API_BASE}/v2/dashboard/analysis/jobs/${id}/events?token=${encodeURIComponent(token)}`;
      const source = new EventSource(url);

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === "completed") {
            toast.success("Analysis ready", {
              description: data.template_name ?? "View results",
              action: {
                label: "View",
                onClick: () => { window.location.href = `/dashboard/analysis/jobs/${id}`; },
              },
            });
            source.close();
            sourcesRef.current.delete(id);
            onJobCompleted?.(id);
          } else if (data.status === "failed") {
            toast.error("Analysis failed", {
              description: data.reason ?? "Unknown error",
            });
            source.close();
            sourcesRef.current.delete(id);
            onJobCompleted?.(id);
          } else if (data.status === "cancelled") {
            toast("Analysis cancelled");
            source.close();
            sourcesRef.current.delete(id);
            onJobCompleted?.(id);
          }
        } catch { /* ignore non-JSON */ }
      };

      source.onerror = () => {
        // EventSource auto-reconnects. If it fails repeatedly, close it.
        // The browser handles retry with exponential backoff.
      };

      sourcesRef.current.set(id, source);
    }

    return () => {
      sourcesRef.current.forEach((s) => s.close());
      sourcesRef.current.clear();
    };
  }, [jobIds, onJobCompleted]);
}
