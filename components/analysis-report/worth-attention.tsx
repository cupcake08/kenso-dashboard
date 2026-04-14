import { SeverityBadge } from "./severity-badge";
import { ReferencePlayerBtn } from "./reference-player-btn";
import type { AnalysisResultV2 } from "@/types/analysis";

export function WorthAttention({ result }: { result: AnalysisResultV2 }) {
  const items = (result.findings ?? []).filter((f) => f.severity !== undefined);
  if (items.length === 0) return null;

  // Sort by severity: critical > warning > info.
  const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const sorted = [...items].sort(
    (a, b) => (severityRank[a.severity ?? "info"] ?? 3) - (severityRank[b.severity ?? "info"] ?? 3),
  );

  return (
    <section className="my-10">
      <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-4">Worth attention</h3>
      <div className="flex flex-col gap-3">
        {sorted.map((f, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/30 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-medium">{f.title ?? f.category}</span>
              <SeverityBadge severity={(f.severity as "info" | "warning" | "critical") ?? "info"} />
            </div>
            {f.description && <p className="text-sm text-muted-foreground mb-3">{f.description}</p>}
            {f.evidenceRef && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-border">
                <ReferencePlayerBtn reference={f.evidenceRef} />
                <span className="italic">&ldquo;{f.evidenceRef.spanText}&rdquo;</span>
              </div>
            )}
            {!f.evidenceRef && f.evidence && (
              <p className="text-sm text-muted-foreground italic pt-2 border-t border-border">&ldquo;{f.evidence}&rdquo;</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
