"use client";
import { Play } from "lucide-react";
import type { Reference } from "@/types/analysis";

export function ReferencePlayerBtn({ reference }: { reference: Reference }) {
  function play() {
    // Scroll to player if present.
    document.getElementById("recordings-player")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    // Dispatch event — recordings-player listens (Task 32).
    window.dispatchEvent(
      new CustomEvent("kenso:play-segment", {
        detail: {
          segmentId: reference.segmentId,
          offsetMs: reference.offsetMs,
          durationMs: reference.durationMs,
        },
      }),
    );
  }

  const timeLabel = new Date(reference.absoluteTime).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const durSec = Math.max(1, Math.round(reference.durationMs / 1000));

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`Play audio at ${timeLabel} for ${durSec} seconds`}
      className="inline-flex items-center gap-1 text-emerald-500 hover:text-emerald-400 text-sm font-medium"
    >
      <Play className="w-3.5 h-3.5" aria-hidden />
      {timeLabel}
    </button>
  );
}
