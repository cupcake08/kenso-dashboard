"use client";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Calendar, ToggleLeft, ToggleRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { listSchedules, apiFetch } from "@/lib/api";
import type { AnalysisSchedule } from "@/types/analysis";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_SCHEDULES: AnalysisSchedule[] = [
  {
    scheduleId: "sched_demo_01", templateId: "tmpl_staff", templateName: "Staff Performance Review",
    micIds: ["mic_lobby_01", "mic_counter_02"], scheduleType: "recurring", recurrenceRule: "0 9 * * 1-6",
    analysisWindowHours: 9, timezone: "Asia/Kolkata", enabled: true,
    nextRunAt: new Date(Date.now() + 86400000).toISOString(), lastRunAt: new Date(Date.now() - 86400000).toISOString(),
    runCount: 12, createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    scheduleId: "sched_demo_02", templateId: "tmpl_compliance", templateName: "Compliance & Policy Audit",
    micIds: ["mic_counter_02"], scheduleType: "recurring", recurrenceRule: "0 18 * * 5",
    analysisWindowHours: 10, timezone: "Asia/Kolkata", enabled: false,
    nextRunAt: "", lastRunAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    runCount: 3, createdAt: new Date(Date.now() - 21 * 86400000).toISOString(),
  },
];

function formatNextRun(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SchedulesPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<AnalysisSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (IS_DEMO) {
      setSchedules(DEMO_SCHEDULES);
      setLoading(false);
      return;
    }
    // Wait for Firebase auth before making API calls
    let unsub: (() => void) | undefined;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      import("@/lib/firebase").then(({ auth }) => {
        if (!auth) { setLoading(false); return; }
        unsub = onAuthStateChanged(auth, (user: unknown) => {
          if (!user) { setLoading(false); return; }
          listSchedules()
            .then(setSchedules)
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false));
        });
      });
    });
    return () => unsub?.();
  }, []);

  async function toggleSchedule(s: AnalysisSchedule) {
    setToggling(s.scheduleId);
    try {
      if (IS_DEMO) {
        await new Promise((r) => setTimeout(r, 300));
        setSchedules((prev) =>
          prev.map((x) => x.scheduleId === s.scheduleId ? { ...x, enabled: !x.enabled } : x)
        );
        return;
      }
      await apiFetch(`/analysis/schedules/${s.scheduleId}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      setSchedules((prev) =>
        prev.map((x) => x.scheduleId === s.scheduleId ? { ...x, enabled: !x.enabled } : x)
      );
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  }

  async function deleteSchedule(s: AnalysisSchedule) {
    if (!confirm(`Delete schedule for "${s.templateName}"?`)) return;
    try {
      if (IS_DEMO) {
        setSchedules((prev) => prev.filter((x) => x.scheduleId !== s.scheduleId));
        return;
      }
      await apiFetch(`/analysis/schedules/${s.scheduleId}`, { method: "DELETE" });
      setSchedules((prev) => prev.filter((x) => x.scheduleId !== s.scheduleId));
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/analysis")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Schedules</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recurring and one-time analysis schedules</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {schedules.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/50 p-10 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No schedules yet. Create one from the Analysis page.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Template</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Next Run</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Runs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules.map((s) => (
                <tr key={s.scheduleId} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{s.templateName}</p>
                    <p className="text-xs text-muted-foreground">{s.micIds.length} device{s.micIds.length !== 1 ? "s" : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <BadgeVariant variant="blue" className="text-xs capitalize">
                      {s.scheduleType.replace("_", " ")}
                    </BadgeVariant>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatNextRun(s.nextRunAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.runCount}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSchedule(s)}
                      disabled={toggling === s.scheduleId}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium transition-colors",
                        s.enabled ? "text-emerald-400" : "text-muted-foreground"
                      )}
                    >
                      {toggling === s.scheduleId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : s.enabled ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                      {s.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteSchedule(s)}
                      className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
