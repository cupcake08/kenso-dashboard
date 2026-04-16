import type { AnalysisResultV2 } from "@/types/analysis";
import { Sparkline } from "./sparkline";

function metricsFor(result: AnalysisResultV2): Array<{ label: string; value: string | number }> {
  if (result.vertical === "restaurant") {
    const m = result.restaurantMetrics;
    return [
      { label: "orders", value: m.ordersDetected },
      { label: "upsell attach", value: `${Math.round(m.upsellAttachRate * 100)}%` },
      { label: "complaints", value: m.complaintCount },
      { label: "avg sentiment", value: result.sentiment?.average?.toFixed(2) ?? "–" },
    ];
  }
  if (result.vertical === "ticketing") {
    const m = result.ticketingMetrics;
    return [
      { label: "bookings", value: m.bookingsDetected },
      { label: "upsell attach", value: `${Math.round(m.upsellAttachRate * 100)}%` },
      { label: "complaints", value: m.complaintCount },
      { label: "avg sentiment", value: result.sentiment?.average?.toFixed(2) ?? "–" },
    ];
  }
  if (result.vertical === "generic") {
    const m = result.genericMetrics;
    return [
      { label: "conversations", value: m.conversationCount },
      { label: "topics", value: m.topics.length },
      { label: "minutes analyzed", value: result.minutesAnalyzed ?? 0 },
      { label: "avg sentiment", value: result.sentiment?.average?.toFixed(2) ?? "–" },
    ];
  }
  return [
    { label: "minutes analyzed", value: result.minutesAnalyzed ?? 0 },
    { label: "findings", value: (result.findings ?? []).length },
    { label: "highlights", value: (result.highlights ?? []).length },
    { label: "avg sentiment", value: result.sentiment?.average?.toFixed(2) ?? "–" },
  ];
}

export function AtAGlance({ result }: { result: AnalysisResultV2 }) {
  const metrics = metricsFor(result);
  return (
    <section className="my-10">
      <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-4">At a glance</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-card/30 p-4">
            <div className="text-2xl font-display tabular-nums">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground mb-1">Sentiment over the shift</div>
      <div className="text-emerald-500">
        <Sparkline values={result.sentiment?.values ?? []} />
      </div>
    </section>
  );
}
