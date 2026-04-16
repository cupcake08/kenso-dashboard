"use client";
import { QuoteCard } from "./quote-card";
import type { AnalysisResultV2 } from "@/types/analysis";

export function HeroLead({ result }: { result: AnalysisResultV2 }) {
  // If we have a hero quote, prefer showing it.
  if (result.heroQuote) {
    return (
      <section className="mb-8">
        <QuoteCard reference={result.heroQuote} hero />
      </section>
    );
  }

  // Fallback: first sentence of summary as a large editorial headline.
  const summary = result.summary ?? "";
  const firstSentence = summary.split(/(?<=[.!?])\s+/)[0] ?? summary;
  return (
    <section className="mb-8">
      <h2 className="font-display text-3xl md:text-4xl leading-tight max-w-[65ch]">
        {firstSentence}
      </h2>
    </section>
  );
}
