import type { ReactNode } from "react";
import { ReferencePlayerBtn } from "./reference-player-btn";
import type { Reference } from "@/types/analysis";

type Props = {
  reference: Reference;
  /** Right-aligned footer content (e.g. "masala papad", severity badge, etc.) */
  footer?: ReactNode;
  /** Hero variant: larger type, more padding — used for the lead quote. */
  hero?: boolean;
};

export function QuoteCard({ reference, footer, hero = false }: Props) {
  return (
    <div
      className={[
        "rounded-xl border border-border p-5 transition-colors",
        hero ? "bg-card/60" : "bg-card/30",
      ].join(" ")}
    >
      <blockquote
        className={[
          "font-display leading-relaxed",
          hero ? "text-2xl" : "text-lg",
        ].join(" ")}
      >
        &ldquo;{reference.spanText}&rdquo;
      </blockquote>
      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
        <ReferencePlayerBtn reference={reference} />
        {reference.context && <span>· {reference.context}</span>}
        {footer && <span className="ml-auto">{footer}</span>}
      </div>
    </div>
  );
}
