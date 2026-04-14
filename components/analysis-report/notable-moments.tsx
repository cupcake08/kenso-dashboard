import { QuoteCard } from "./quote-card";
import type { AnalysisResultV2 } from "@/types/analysis";

export function NotableMoments({ result }: { result: AnalysisResultV2 }) {
  const items = (result.highlights ?? []).slice(0, 5);
  if (items.length === 0) return null;
  return (
    <section className="my-10">
      <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-4">Notable moments</h3>
      <div className="flex flex-col gap-3">
        {items.map((h, i) => {
          // Only render QuoteCard when a reference is available; fall back to
          // a plain description card otherwise.
          if (h.reference) {
            return (
              <QuoteCard
                key={i}
                reference={h.reference}
                footer={<span className="text-xs uppercase tracking-wider">{h.type}</span>}
              />
            );
          }
          return (
            <div key={i} className="rounded-xl border border-border bg-card/30 p-4">
              <p className="text-sm">{h.description}</p>
              <span className="text-xs uppercase tracking-wider text-muted-foreground mt-2 block">{h.type}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
