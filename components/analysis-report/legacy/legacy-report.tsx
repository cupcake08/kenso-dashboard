"use client";

import { useState } from "react";
import {
  AlertTriangle, Info, CheckCircle2, Clock, Sparkles,
} from "lucide-react";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { cn } from "@/lib/utils";
import type { AnalysisResult, AnalysisFinding, AnalysisHighlight } from "@/types/analysis";

/* ── Helpers ────────────────────────────────────────────────────── */

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/* ── Sub-components (extracted from job detail page) ─────────────── */

const SEVERITY_CONFIG = {
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: AlertTriangle },
  warning:  { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: AlertTriangle },
  info:     { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: Info },
};

function FindingCard({ finding }: { finding: AnalysisFinding }) {
  const cfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={cn("rounded-lg border p-4", cfg.bg)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", cfg.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-sm font-medium", cfg.color)}>{finding.title}</span>
            <span className="text-xs text-muted-foreground">{formatTime(finding.absoluteTime)}</span>
            <BadgeVariant variant="slate" className="text-xs capitalize">{finding.category}</BadgeVariant>
          </div>
          <p className="mt-1 text-sm text-foreground">{finding.description}</p>
          {finding.evidence && (
            <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{finding.evidence}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightRow({ highlight }: { highlight: AnalysisHighlight }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-mono text-muted-foreground w-20 flex-shrink-0 pt-0.5">
        {formatTime(highlight.absoluteTime)}
      </span>
      <BadgeVariant variant="blue" className="text-xs capitalize flex-shrink-0">{highlight.type}</BadgeVariant>
      <p className="text-sm text-foreground">{highlight.description}</p>
    </div>
  );
}

/* ── LegacyReport ─────────────────────────────────────────────────── */

type Tab = "summary" | "findings" | "highlights";

export function LegacyReport({ result }: { result: AnalysisResult }) {
  const [tab, setTab] = useState<Tab>("summary");

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "summary",    label: "Summary" },
    { key: "findings",   label: "Findings",   count: result.findings.length },
    { key: "highlights", label: "Highlights", count: result.highlights.length },
  ];

  return (
    <div className="space-y-4">
      {/* Legacy chip */}
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground border border-border">
        Legacy analysis · prior to business-type support
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 border border-border w-fit">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              tab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}{count !== undefined && count > 0 ? ` (${count})` : ""}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {tab === "summary" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/50 p-5">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Summary</h4>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{result.summary}</p>
          </div>

          {result.recommendations.length > 0 && (
            <div className="rounded-xl border border-border bg-card/50 p-5">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />Recommendations
              </h4>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.speakerBreakdown && Object.keys(result.speakerBreakdown).length > 0 && (
            <div className="rounded-xl border border-border bg-card/50 p-5">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Speaker Breakdown
              </h4>
              <div className="space-y-2">
                {Object.entries(result.speakerBreakdown).map(([speaker, pct]) => (
                  <div key={speaker} className="flex items-center gap-3">
                    <span className="text-sm text-foreground w-20">{speaker}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.round(pct * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {Math.round(pct * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Findings tab */}
      {tab === "findings" && (
        <div className="space-y-3">
          {result.findings.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No findings — everything looks normal.</p>
            </div>
          ) : (
            result.findings.map((f, i) => <FindingCard key={i} finding={f} />)
          )}
        </div>
      )}

      {/* Highlights tab */}
      {tab === "highlights" && (
        <div className="rounded-xl border border-border bg-card/50 divide-y divide-border">
          {result.highlights.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No highlights found.</p>
            </div>
          ) : (
            result.highlights.map((h, i) => <HighlightRow key={i} highlight={h} />)
          )}
        </div>
      )}
    </div>
  );
}
