"use client";

import { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Loader2,
  ChevronLeft, ChevronRight, Disc3,
} from "lucide-react";
import { useRecordingsPlayer, type Segment } from "@/hooks/use-recordings-player";
import { Button } from "@/components/ui/button";

/* ── Helpers ── */

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

/* ── SeekBar ──
 * Draggable progress bar with pointer capture for smooth scrubbing.
 * 44px interaction zone (tall enough for mobile), 6px visible track.
 * Thumb appears on hover/drag with a soft emerald glow. */

function SeekBar({ currentTime, totalDuration, onSeek }: {
  currentTime: number;
  totalDuration: number;
  onSeek: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [interactPct, setInteractPct] = useState(0);

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
  const displayPct = dragging ? interactPct : progress;

  const pctFromEvent = useCallback((e: { clientX: number }) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pct = pctFromEvent(e);
    setDragging(true);
    setInteractPct(pct);
  }, [pctFromEvent]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const pct = pctFromEvent(e);
    if (dragging) {
      setInteractPct(pct);
    } else {
      setInteractPct(pct);
    }
  }, [dragging, pctFromEvent]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragging) {
      const pct = pctFromEvent(e);
      onSeek(pct * totalDuration);
      setDragging(false);
    }
  }, [dragging, pctFromEvent, onSeek, totalDuration]);

  const onPointerCancel = useCallback(() => {
    setDragging(false);
  }, []);

  if (totalDuration === 0) return null;

  return (
    <div className="px-1">
      {/* 44px tall interaction zone for mobile-friendly touch targets */}
      <div
        ref={trackRef}
        className="relative h-11 flex items-center cursor-pointer touch-none select-none group"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => { setHovering(false); if (!dragging) setInteractPct(0); }}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalDuration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={formatTime(currentTime)}
        tabIndex={0}
      >
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted/40 transition-[height] duration-150 group-hover:h-2">
          {/* Hover preview fill (lighter) */}
          {(hovering || dragging) && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/15 transition-none"
              style={{ width: `${interactPct * 100}%` }}
            />
          )}
          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-none"
            style={{ width: `${displayPct * 100}%` }}
          />
        </div>

        {/* Thumb — visible on hover or drag */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform duration-100 ${
            dragging || hovering ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{ left: `${displayPct * 100}%` }}
        >
          <div className="h-3.5 w-3.5 rounded-full bg-primary shadow-[0_0_8px_rgba(16,185,129,0.35)]" />
        </div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between -mt-1.5 px-0.5">
        <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
          {formatTime(currentTime)}
        </span>
        {dragging && (
          <span className="text-[0.6875rem] text-primary tabular-nums font-medium">
            {formatTime(interactPct * totalDuration)}
          </span>
        )}
        <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
          {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}

/* ── SegmentList ──
 * Scrollable list of recording segments with auto-scroll to active,
 * animated "now playing" bars, and smooth state transitions. */

function SegmentList({ segments, currentSegmentIdx, playing, onSelect }: {
  segments: Segment[];
  currentSegmentIdx: number;
  playing: boolean;
  onSelect: (idx: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to active segment when it changes
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentSegmentIdx]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Recording segments"
      className="max-h-64 overflow-y-auto space-y-0.5 scrollbar-thin"
    >
      {segments.map((seg, i) => {
        const isActive = i === currentSegmentIdx;
        return (
          <button
            key={seg.segment_id}
            ref={isActive ? activeRef : undefined}
            role="option"
            aria-selected={isActive}
            onClick={() => onSelect(i)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            {/* Leading indicator */}
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {isActive && playing ? (
                <div className="flex items-center gap-[2px]">
                  {[0, 1, 2].map((j) => (
                    <motion.div
                      key={j}
                      className="w-[2px] bg-primary rounded-full"
                      animate={{ height: [4, 12, 4] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: j * 0.15,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              ) : isActive ? (
                <Play className="h-3.5 w-3.5 fill-current" />
              ) : (
                <span className="text-[0.6875rem] tabular-nums opacity-40">{i + 1}</span>
              )}
            </div>

            {/* Time */}
            <span className="text-xs tabular-nums w-16 shrink-0">
              {formatClockTime(seg.start_time_unix)}
            </span>

            {/* Duration bar */}
            <div className="flex-1 min-w-0">
              <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-colors duration-150 ${
                    isActive ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                  style={{ width: `${Math.min(100, (seg.duration_ms / 300000) * 100)}%` }}
                />
              </div>
            </div>

            {/* Duration label */}
            <span className="text-[0.6875rem] tabular-nums text-muted-foreground/50 shrink-0">
              {formatTime(seg.duration_ms / 1000)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── RecordingsPlayer ──
 * Main exported component. Renders date picker, player card, and segment list. */

export const RecordingsPlayer = memo(function RecordingsPlayer({ deviceId }: { deviceId: string }) {
  const { segments, state, toggle, seekTo, skip, cycleSpeed, loadDate, play } = useRecordingsPlayer(deviceId);

  // Date navigation (today + 2 previous days — matches 2-day retention)
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

  // Keyboard: Space for play/pause
  useEffect(() => {
    if (segments.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, segments.length]);

  const currentSeg = state.currentSegmentIdx >= 0 ? segments[state.currentSegmentIdx] : null;

  return (
    <div className="space-y-4">
      {/* ── Date selector ── */}
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

      {/* ── Loading / Empty ── */}
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
              {selectedDate === today
                ? "No audio recorded today yet"
                : `No recordings on ${formatDate(selectedDate)}`}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Player card ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card/50 overflow-hidden"
          >
            {/* Now playing info */}
            <div className="px-5 pt-4 pb-0">
              <div className="flex items-center justify-between mb-2">
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
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buffering
                  </span>
                )}
              </div>

              {/* Seek bar */}
              <SeekBar
                currentTime={state.currentTime}
                totalDuration={state.totalDuration}
                onSeek={seekTo}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 px-5 py-3 border-t border-border/50">
              {/* Speed toggle */}
              <button
                onClick={cycleSpeed}
                className="px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[2.5rem]"
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

              {/* Play / Pause — animated icon swap */}
              <button
                onClick={toggle}
                disabled={segments.length === 0}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={state.playing ? "Pause" : "Play"}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {state.playing ? (
                    <motion.div
                      key="pause"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <Pause className="h-[18px] w-[18px]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <Play className="h-[18px] w-[18px] ml-0.5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* Skip forward */}
              <button
                onClick={() => skip(15)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Skip forward 15 seconds"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              {/* Time display */}
              <span className="text-xs tabular-nums text-muted-foreground min-w-[5rem] text-center hidden sm:inline">
                {formatTime(state.currentTime)} / {formatTime(state.totalDuration)}
              </span>
            </div>
          </motion.div>

          {/* ── Segment list ── */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
              Segments
            </p>
            <div className="rounded-xl border border-border bg-card/30 p-1.5">
              <SegmentList
                segments={segments}
                currentSegmentIdx={state.currentSegmentIdx}
                playing={state.playing}
                onSelect={(idx) => play(idx)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
});
