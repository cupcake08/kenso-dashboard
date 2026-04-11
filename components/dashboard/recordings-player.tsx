"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Loader2, ChevronLeft, ChevronRight, Disc3 } from "lucide-react";
import { useRecordingsPlayer, type Segment } from "@/hooks/use-recordings-player";
import { Button } from "@/components/ui/button";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatClockTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** Timeline bar showing segment coverage across the day */
function Timeline({ segments, currentTime, totalDuration, currentSegmentIdx, onSeek }: {
  segments: Segment[];
  currentTime: number;
  totalDuration: number;
  currentSegmentIdx: number;
  onSeek: (seconds: number) => void;
}) {
  if (segments.length === 0 || totalDuration === 0) return null;

  const firstStart = segments[0].start_time_unix;
  const lastEnd = segments[segments.length - 1].end_time_unix;
  const span = lastEnd - firstStart;
  if (span <= 0) return null;

  return (
    <div className="px-1">
      {/* Segment blocks */}
      <div
        className="relative h-2 rounded-full bg-muted/30 cursor-pointer overflow-hidden group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          onSeek(pct * totalDuration);
        }}
      >
        {/* Segment blocks showing coverage */}
        {segments.map((seg, i) => {
          const left = ((seg.start_time_unix - firstStart) / span) * 100;
          const width = ((seg.end_time_unix - seg.start_time_unix) / span) * 100;
          const isActive = i === currentSegmentIdx;
          return (
            <div
              key={seg.segment_id}
              className={`absolute top-0 h-full rounded-full transition-colors ${
                isActive ? "bg-primary" : "bg-primary/30 group-hover:bg-primary/40"
              }`}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }}
            />
          );
        })}

        {/* Playhead */}
        {totalDuration > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground rounded-full transition-[left] duration-100"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          />
        )}
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
          {formatClockTime(firstStart)}
        </span>
        <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
          {formatClockTime(lastEnd)}
        </span>
      </div>
    </div>
  );
}

/** Segment list showing individual recordings */
function SegmentList({ segments, currentSegmentIdx, onSelect }: {
  segments: Segment[];
  currentSegmentIdx: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div role="listbox" aria-label="Recording segments" className="max-h-64 overflow-y-auto space-y-0.5 scrollbar-thin">
      {segments.map((seg, i) => {
        const isActive = i === currentSegmentIdx;
        return (
          <button
            key={seg.segment_id}
            role="option"
            aria-selected={isActive}
            onClick={() => onSelect(i)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <span className="text-xs tabular-nums w-14 shrink-0">
              {formatClockTime(seg.start_time_unix)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={`h-full rounded-full ${isActive ? "bg-primary" : "bg-muted-foreground/30"}`}
                  style={{ width: `${Math.min(100, (seg.duration_ms / 300000) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground/60 shrink-0">
              {formatTime(seg.duration_ms / 1000)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const RecordingsPlayer = memo(function RecordingsPlayer({ deviceId }: { deviceId: string }) {
  const { segments, state, toggle, seekTo, skip, cycleSpeed, loadDate, play } = useRecordingsPlayer(deviceId);

  // Date navigation
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);
  const [selectedDate, setSelectedDate] = useState(today);

  const dates = useMemo(() => {
    const result: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push(d.toISOString().split("T")[0]);
    }
    return result;
  }, []);

  useEffect(() => {
    loadDate(selectedDate);
  }, [selectedDate, loadDate]);

  const currentSeg = state.currentSegmentIdx >= 0 ? segments[state.currentSegmentIdx] : null;

  return (
    <div className="space-y-5">
      {/* Date selector */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const idx = dates.indexOf(selectedDate);
            if (idx < dates.length - 1) setSelectedDate(dates[idx + 1]);
          }}
          disabled={selectedDate === dates[dates.length - 1]}
          aria-label="Previous day"
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1.5" role="group" aria-label="Select date">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              aria-pressed={selectedDate === d}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selectedDate === d
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent"
              }`}
            >
              {d === today ? "Today" : formatDate(d)}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const idx = dates.indexOf(selectedDate);
            if (idx > 0) setSelectedDate(dates[idx - 1]);
          }}
          disabled={selectedDate === dates[0]}
          aria-label="Next day"
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading / Empty */}
      {state.loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : segments.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/30">
          <Disc3 className="h-6 w-6 text-muted-foreground/30" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/70">No recordings</p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              {selectedDate === today ? "No audio recorded today yet" : `No recordings on ${formatDate(selectedDate)}`}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Player card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card/50 overflow-hidden"
          >
            {/* Now playing info */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0">
                  {currentSeg ? (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        {formatClockTime(currentSeg.start_time_unix)} – {formatClockTime(currentSeg.end_time_unix)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Segment {state.currentSegmentIdx + 1} of {segments.length}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {segments.length} recording{segments.length !== 1 ? "s" : ""} · {formatTime(state.totalDuration)} total
                    </p>
                  )}
                </div>
                {state.buffering && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buffering
                  </span>
                )}
              </div>

              {/* Timeline */}
              <Timeline
                segments={segments}
                currentTime={state.currentTime}
                totalDuration={state.totalDuration}
                currentSegmentIdx={state.currentSegmentIdx}
                onSeek={seekTo}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-border/50">
              {/* Speed */}
              <button
                onClick={cycleSpeed}
                className="px-2 py-1 rounded text-xs font-semibold tabular-nums text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Playback speed: ${state.speed}x`}
              >
                {state.speed}x
              </button>

              {/* Skip back */}
              <button
                onClick={() => skip(-15)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Skip back 15 seconds"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={toggle}
                disabled={segments.length === 0}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={state.playing ? "Pause" : "Play"}
              >
                {state.playing
                  ? <Pause className="h-4.5 w-4.5" />
                  : <Play className="h-4.5 w-4.5 ml-0.5" />
                }
              </button>

              {/* Skip forward */}
              <button
                onClick={() => skip(15)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Skip forward 15 seconds"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              {/* Current time / Total */}
              <span className="text-xs tabular-nums text-muted-foreground min-w-[5rem] text-center">
                {formatTime(state.currentTime)} / {formatTime(state.totalDuration)}
              </span>
            </div>
          </motion.div>

          {/* Segment list */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Segments</p>
            <div className="rounded-xl border border-border bg-card/30 p-1.5">
              <SegmentList
                segments={segments}
                currentSegmentIdx={state.currentSegmentIdx}
                onSelect={(idx) => play(idx)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
});
