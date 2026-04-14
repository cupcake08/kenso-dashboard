import type { AnalysisResultV2 } from "@/types/analysis";

const VERTICAL_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  retail:     "Retail",
  ticketing:  "Ticketing",
  service:    "Service",
  generic:    "Generic",
  "":         "Legacy",
};

export function ReportHeader({ result }: { result: AnalysisResultV2 }) {
  const dateLabel = new Date(result.period.startUnix * 1000).toLocaleDateString([], {
    weekday: "short", month: "short", day: "numeric",
  });
  return (
    <header className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
      <span>{dateLabel}</span>
      {result.period.label && <span>· {result.period.label}</span>}
      <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-md border border-border text-xs">
        {VERTICAL_LABEL[result.vertical] ?? "Unknown"}
      </span>
    </header>
  );
}
