import { ArrowRight } from "lucide-react";

export function Recommendations({ items }: { items: string[] }) {
  const list = (items ?? []).slice(0, 5).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <section className="my-10">
      <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-4">Recommendations</h3>
      <ul className="flex flex-col gap-3">
        {list.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <ArrowRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
