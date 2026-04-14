"use client";

import { useState } from "react";
import Link from "next/link";
import { Lightbulb, X } from "lucide-react";
import { toast } from "sonner";
import { useBusinessTypeSuggestion } from "@/hooks/use-business-type";
import { confirmBusinessTypeSuggestion } from "@/lib/api";

const VERTICAL_LABEL: Record<string, string> = {
  restaurant: "a Restaurant",
  retail:     "a Retail store",
  ticketing:  "a Ticketing counter",
  service:    "a Service business",
  generic:    "a general business",
};

export function BusinessTypeSuggestBanner() {
  const { suggestion, mutate } = useBusinessTypeSuggestion();
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!suggestion || sessionDismissed) return null;

  const label = VERTICAL_LABEL[suggestion.vertical] ?? "a business";

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);
    try {
      await confirmBusinessTypeSuggestion();
      await mutate();
      toast.success("Thanks — we'll tune future analyses for your business.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to confirm");
      setConfirming(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
      <Lightbulb className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="font-medium">
          Looks like you&apos;re running {label}.
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {suggestion.reason}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            {confirming ? "Saving…" : "Yes, that's right"}
          </button>
          <Link
            href="/dashboard/settings/business-type"
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-card/50 transition-colors"
          >
            Pick a different one
          </Link>
        </div>
      </div>
      <button
        onClick={() => setSessionDismissed(true)}
        aria-label="Dismiss for this session"
        className="text-muted-foreground hover:text-foreground p-1"
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
