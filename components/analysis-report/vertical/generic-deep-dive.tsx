import type { GenericMetrics } from "@/types/analysis";

export function GenericDeepDive({ metrics }: { metrics: GenericMetrics }) {
  const topics = (metrics.topics ?? []).slice(0, 10);
  if (topics.length === 0 && metrics.conversationCount === 0) return null;
  return (
    <section className="my-10">
      <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-4">Deep dive</h3>
      {metrics.conversationCount > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          {metrics.conversationCount} conversation{metrics.conversationCount !== 1 ? "s" : ""} detected · avg length{" "}
          {metrics.avgConversationSec}s
        </p>
      )}
      {topics.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 text-sm">Topics detected</h4>
          <div className="flex flex-wrap gap-2">
            {topics.map((t, i) => (
              <span key={i} className="inline-flex items-center px-2 py-1 rounded-md border border-border bg-card/30 text-xs">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
