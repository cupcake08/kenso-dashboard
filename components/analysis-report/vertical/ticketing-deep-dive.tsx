import type { TicketingMetrics } from "@/types/analysis";
import { QuoteCard } from "../quote-card";

export function TicketingDeepDive({ metrics }: { metrics: TicketingMetrics }) {
  const hasUpsells = (metrics.topUpsellMoments ?? []).length > 0;
  const hasComplaints = (metrics.complaintClusters ?? []).length > 0;
  const paymentEntries = Object.entries(metrics.paymentEventsByMethod ?? {});
  const channelEntries = Object.entries(metrics.bookingsByChannel ?? {});

  if (!hasUpsells && !hasComplaints && paymentEntries.length === 0 && channelEntries.length === 0) return null;

  return (
    <section className="my-10">
      <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-4">Ticketing deep dive</h3>

      {channelEntries.length > 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          Bookings by channel: {channelEntries.map(([k, v]) => `${k.replace("_", " ")} ${v}`).join(" · ")}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {hasUpsells && (
          <div>
            <h4 className="font-medium mb-3 text-sm">Upsell moments</h4>
            <div className="flex flex-col gap-3">
              {metrics.topUpsellMoments.slice(0, 5).map((m, i) => (
                <QuoteCard
                  key={i}
                  reference={m.reference}
                  footer={
                    <span className="text-xs">
                      +{m.itemAttached}{m.converted ? " ✓" : ""}
                    </span>
                  }
                />
              ))}
            </div>
          </div>
        )}
        {hasComplaints && (
          <div>
            <h4 className="font-medium mb-3 text-sm">Complaint clusters</h4>
            <div className="flex flex-col gap-3">
              {metrics.complaintClusters.slice(0, 5).map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-card/30 p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm">{c.theme}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.count} cases · {c.resolved} resolved
                    </span>
                  </div>
                  {c.firstExample?.spanText && (
                    <div className="mt-2 text-sm text-muted-foreground italic">
                      &ldquo;{c.firstExample.spanText}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {paymentEntries.length > 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Payment events: {paymentEntries.map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ")}
        </p>
      )}
    </section>
  );
}
