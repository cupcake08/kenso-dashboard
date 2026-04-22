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

/* ── Types ── */

interface HourBucket {
  hourUnix: number;
  label: string;
  entries: { seg: Segment; idx: number }[];
  totalSec: number;
}

/* ── DayTimeline ──
 * Overview bar showing when recordings happened during the day. Segments are
 * positioned by their real-world timestamps (unix time). Hour boundaries are
 * shown as thin lines. Click anywhere to seek — clicks on segments seek to the
 * proportional position within; clicks in gaps snap to the nearest segment edge.
 *
 * Coordinate mapping: the timeline is in unix-time space, the player is in
 * cumulative-audio-time space. The `offsets` array bridges the two. */

function DayTimeline({ segments, offsets, currentTime, totalDuration, onSeek }: {
  segments: Segment[];
  offsets: number[];
  currentTime: number;
  totalDuration: number;
  onSeek: (audioSeconds: number) => void;
}) {
  const [hoverInfo, setHoverInfo] = useState<{ pct: number; label: string } | null>(null);
  const hasTimeline = segments.length >= 2;
  const firstStart = hasTimeline ? segments[0].start_time_unix : 0;
  const lastEnd = hasTimeline ? segments[segments.length - 1].end_time_unix : 0;
  const span = lastEnd - firstStart;

  // Convert current audio time → timeline percentage.
  // Computed directly every render (no useMemo) — the calculation is cheap
  // and useMemo can skip recomputation during rapid rAF state updates.
  let playheadPct = 0;
  if (hasTimeline && span > 0) {
    for (let i = 0; i < segments.length; i++) {
      const segDur = segments[i].duration_ms / 1000;
      const segEnd = offsets[i] + segDur;
      if (currentTime <= segEnd || i === segments.length - 1) {
        const frac = segDur > 0 ? Math.min(1, Math.max(0, (currentTime - offsets[i]) / segDur)) : 0;
        const unixAt = segments[i].start_time_unix + frac * (segments[i].end_time_unix - segments[i].start_time_unix);
        playheadPct = ((unixAt - firstStart) / span) * 100;
        break;
      }
    }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const hoverUnix = firstStart + pct * span;
    setHoverInfo({ pct: pct * 100, label: formatClockTime(hoverUnix) });
  }, [firstStart, span]);

  const handleMouseLeave = useCallback(() => setHoverInfo(null), []);

  // Click → convert timeline position to audio time → seek
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickedUnix = firstStart + pct * span;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      // Within a segment — seek to proportional position
      if (clickedUnix >= seg.start_time_unix && clickedUnix <= seg.end_time_unix) {
        const frac = (clickedUnix - seg.start_time_unix) / (seg.end_time_unix - seg.start_time_unix);
        onSeek(offsets[i] + frac * (seg.duration_ms / 1000));
        return;
      }
      // In a gap — snap to nearest segment edge
      if (i < segments.length - 1 && clickedUnix > seg.end_time_unix && clickedUnix < segments[i + 1].start_time_unix) {
        const mid = (seg.end_time_unix + segments[i + 1].start_time_unix) / 2;
        onSeek(clickedUnix < mid
          ? offsets[i] + seg.duration_ms / 1000 - 0.01
          : offsets[i + 1]);
        return;
      }
    }
  }, [segments, offsets, firstStart, span, onSeek]);

  // Hour boundary lines (skip lines too close to edges)
  const hourLines = useMemo(() => {
    if (!hasTimeline || span <= 0) return [];
    const lines: number[] = [];
    let t = Math.ceil(firstStart / 3600) * 3600;
    while (t < lastEnd) {
      const pct = ((t - firstStart) / span) * 100;
      if (pct > 3 && pct < 97) lines.push(pct);
      t += 3600;
    }
    return lines;
  }, [firstStart, hasTimeline, lastEnd, span]);

  if (!hasTimeline || span <= 0) return null;

  return (
    <div className="px-1 mb-1">
      <p className="text-[0.625rem] text-muted-foreground/40 uppercase tracking-wider mb-1 select-none">
        Day overview
      </p>
      <div
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Hover tooltip — outside overflow-hidden child so it isn't clipped */}
        {hoverInfo && (
          <div
            className="absolute -top-5 -translate-x-1/2 px-1.5 py-0.5 rounded bg-popover border border-border text-[0.625rem] text-foreground tabular-nums whitespace-nowrap pointer-events-none z-10"
            style={{ left: `${hoverInfo.pct}%` }}
          >
            {hoverInfo.label}
          </div>
        )}
        <div
          className="relative h-7 rounded-lg bg-muted/20 cursor-pointer overflow-hidden"
          onClick={handleClick}
          aria-hidden="true"
        >
          {/* Hour boundary lines */}
          {hourLines.map((pct) => (
            <div
              key={pct}
              className="absolute top-0 bottom-0 w-px bg-border/30"
              style={{ left: `${pct}%` }}
            />
          ))}

          {/* Segment blocks */}
          {segments.map((seg) => {
            const left = ((seg.start_time_unix - firstStart) / span) * 100;
            const width = ((seg.end_time_unix - seg.start_time_unix) / span) * 100;
            return (
              <div
                key={seg.segment_id}
                className="absolute top-1 bottom-1 rounded-sm bg-primary/25 hover:bg-primary/40 transition-colors"
                style={{ left: `${left}%`, width: `${Math.max(width, 0.4)}%` }}
              />
            );
          })}

          {/* Playhead */}
          {totalDuration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_4px_rgba(16,185,129,0.5)]"
              style={{ left: `${Math.min(playheadPct, 99.5)}%` }}
            />
          )}
        </div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-[0.625rem] text-muted-foreground/40 tabular-nums">
          {formatClockTime(firstStart)}
        </span>
        <span className="text-[0.625rem] text-muted-foreground/40 tabular-nums">
          {formatClockTime(lastEnd)}
        </span>
      </div>
    </div>
  );
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
    setInteractPct(pctFromEvent(e));
  }, [pctFromEvent]);

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

/* ── SegmentList (flat) ──
 * Used when there are few segments (<= 12). Simple scrollable list
 * with auto-scroll to active segment. */

function SegmentList({ segments, currentSegmentIdx, playing, onSelect }: {
  segments: Segment[];
  currentSegmentIdx: number;
  playing: boolean;
  onSelect: (idx: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentSegmentIdx]);

  return (
    <div role="listbox" aria-label="Recording segments" className="max-h-72 sm:max-h-96 overflow-y-auto space-y-0.5 scrollbar-thin">
      {segments.map((seg, i) => (
        <SegmentItem
          key={seg.segment_id}
          seg={seg}
          idx={i}
          isActive={i === currentSegmentIdx}
          playing={playing}
          onSelect={onSelect}
          ref={i === currentSegmentIdx ? activeRef : undefined}
        />
      ))}
    </div>
  );
}

/* ── SegmentItem ──
 * Single segment row — extracted for reuse in flat and grouped lists. */

import { forwardRef } from "react";

const SegmentItem = forwardRef<HTMLButtonElement, {
  seg: Segment;
  idx: number;
  isActive: boolean;
  playing: boolean;
  onSelect: (idx: number) => void;
}>(function SegmentItem({ seg, idx, isActive, playing, onSelect }, ref) {
  return (
    <button
      ref={ref}
      role="option"
      aria-selected={isActive}
      onClick={() => onSelect(idx)}
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
          <span className="text-[0.6875rem] tabular-nums opacity-40">{idx + 1}</span>
        )}
      </div>

      <span className="text-xs tabular-nums w-16 shrink-0">
        {formatClockTime(seg.start_time_unix)}
      </span>

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

      <span className="text-[0.6875rem] tabular-nums text-muted-foreground/50 shrink-0">
        {formatTime(seg.duration_ms / 1000)}
      </span>
    </button>
  );
});

/* ── GroupedSegmentList ──
 * Used when there are many segments (> 12). Groups segments by hour
 * with collapsible sections. Auto-expands the group containing the
 * active segment. */

function GroupedSegmentList({ hourBuckets, currentSegmentIdx, playing, onSelect }: {
  hourBuckets: HourBucket[];
  currentSegmentIdx: number;
  playing: boolean;
  onSelect: (idx: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Track expanded groups — start with first group open
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    return hourBuckets.length > 0 ? new Set([hourBuckets[0].hourUnix]) : new Set();
  });

  // Auto-expand active group when active segment changes
  useEffect(() => {
    for (const bucket of hourBuckets) {
      if (bucket.entries.some((e) => e.idx === currentSegmentIdx)) {
        setExpanded((prev) => {
          if (prev.has(bucket.hourUnix)) return prev;
          const next = new Set(prev);
          next.add(bucket.hourUnix);
          return next;
        });
        break;
      }
    }
  }, [currentSegmentIdx, hourBuckets]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentSegmentIdx]);

  const toggleBucket = (hourUnix: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(hourUnix)) next.delete(hourUnix);
      else next.add(hourUnix);
      return next;
    });
  };

  return (
    <div ref={listRef} className="max-h-72 sm:max-h-96 overflow-y-auto scrollbar-thin">
      {hourBuckets.map((bucket) => {
        const isOpen = expanded.has(bucket.hourUnix);
        const hasActive = bucket.entries.some((e) => e.idx === currentSegmentIdx);

        return (
          <div key={bucket.hourUnix}>
            {/* Group header */}
            <button
              type="button"
              onClick={() => toggleBucket(bucket.hourUnix)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors hover:bg-muted/20 ${
                hasActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <ChevronRight
                className={`h-3 w-3 shrink-0 transition-transform duration-150 ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
              <span className="text-xs font-medium tabular-nums">{bucket.label}</span>
              <span className="text-[0.625rem] text-muted-foreground/50 ml-auto tabular-nums">
                {bucket.entries.length} seg · {formatTime(bucket.totalSec)}
              </span>
            </button>

            {/* Segment items */}
            {isOpen && (
              <div className="ml-2.5 border-l border-border/30 pl-0.5 pb-1">
                {bucket.entries.map(({ seg, idx }) => (
                  <SegmentItem
                    key={seg.segment_id}
                    seg={seg}
                    idx={idx}
                    isActive={idx === currentSegmentIdx}
                    playing={playing}
                    onSelect={onSelect}
                    ref={idx === currentSegmentIdx ? activeRef : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── SegmentPanel ──
 * Collapsible panel wrapping the segment list. Default collapsed to a single
 * summary line ("▸ 47 segments · 3h 24m") — saves ~300px of vertical space.
 * Tap to expand and browse segments. Auto-expands when user taps a segment
 * in the DayTimeline or when few segments exist (<= 6). */

function SegmentPanel({ segments, hourBuckets, useGrouped, totalDuration, currentSegmentIdx, playing, onSelect }: {
  segments: Segment[];
  hourBuckets: HourBucket[];
  useGrouped: boolean;
  totalDuration: number;
  currentSegmentIdx: number;
  playing: boolean;
  onSelect: (idx: number) => void;
}) {
  // Auto-open for few segments, collapsed by default for many
  const [open, setOpen] = useState(segments.length <= 6);

  // Reset open state when segments change (new date loaded)
  useEffect(() => {
    setOpen(segments.length <= 6);
  }, [segments]);

  return (
    <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
      {/* Header — always visible, acts as toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Segments
        </span>
        <span className="text-[0.625rem] text-muted-foreground/50 tabular-nums ml-auto">
          {segments.length} recordings · {formatTime(totalDuration)}
        </span>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden"
          >
            <div className="px-1.5 pb-1.5 border-t border-border/30">
              {useGrouped ? (
                <GroupedSegmentList
                  hourBuckets={hourBuckets}
                  currentSegmentIdx={currentSegmentIdx}
                  playing={playing}
                  onSelect={onSelect}
                />
              ) : (
                <SegmentList
                  segments={segments}
                  currentSegmentIdx={currentSegmentIdx}
                  playing={playing}
                  onSelect={onSelect}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── RecordingsPlayer ──
 * Main exported component. Renders date picker, player card with day timeline
 * + seek bar, and collapsible segment panel. */

export const RecordingsPlayer = memo(function RecordingsPlayer({ deviceId }: { deviceId: string }) {
  const { segments, state, toggle, seekTo, skip, cycleSpeed, loadDate, play } = useRecordingsPlayer(deviceId);

  // Listen for kenso:play-segment events dispatched by ReferencePlayerBtn.
  // Finds the matching segment by segmentId, seeks to its cumulative audio
  // offset + the in-segment offsetMs. If playing, playback jumps immediately;
  // if paused, position is updated so next play starts from the right point.
  useEffect(() => {
    function onPlaySegment(e: Event) {
      const ce = e as CustomEvent<{ segmentId: string; offsetMs: number; durationMs: number }>;
      const ref = ce.detail;
      if (!ref) return;

      const idx = segments.findIndex((s) => s.segment_id === ref.segmentId);
      if (idx === -1) {
        console.warn("[RecordingsPlayer] kenso:play-segment: segment not found:", ref.segmentId);
        return;
      }

      // Compute cumulative audio offset for this segment
      let cumulativeOffset = 0;
      for (let i = 0; i < idx; i++) {
        cumulativeOffset += segments[i].duration_ms / 1000;
      }
      const targetSeconds = cumulativeOffset + ref.offsetMs / 1000;
      seekTo(targetSeconds);

      // If paused, also start playback from that position
      if (!state.playing) {
        play(idx);
      }
    }

    window.addEventListener("kenso:play-segment", onPlaySegment);
    return () => window.removeEventListener("kenso:play-segment", onPlaySegment);
    // seekTo and play are defined with useCallback in useRecordingsPlayer and are
    // referentially stable for the component lifetime — omitting them prevents
    // unnecessary listener teardown/re-registration on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, state.playing]);

  // Cumulative audio offsets — bridges audio-time ↔ unix-time for DayTimeline
  const offsets = useMemo(() => {
    let total = 0;
    return segments.map((seg) => {
      const off = total;
      total += seg.duration_ms / 1000;
      return off;
    });
  }, [segments]);

  // Group segments by hour for the grouped list
  const hourBuckets = useMemo((): HourBucket[] => {
    const map = new Map<number, HourBucket>();
    segments.forEach((seg, i) => {
      const d = new Date(seg.start_time_unix * 1000);
      d.setMinutes(0, 0, 0);
      const key = Math.floor(d.getTime() / 1000);
      if (!map.has(key)) {
        map.set(key, {
          hourUnix: key,
          label: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          entries: [],
          totalSec: 0,
        });
      }
      const bucket = map.get(key)!;
      bucket.entries.push({ seg, idx: i });
      bucket.totalSec += seg.duration_ms / 1000;
    });
    return Array.from(map.values()).sort((a, b) => a.hourUnix - b.hourUnix);
  }, [segments]);

  const useGrouped = segments.length > 12;

  // Date navigation (today + 2 previous days — matches 2-day retention).
  // Use LOCAL date, not UTC. At 2 AM IST, toISOString() returns yesterday's
  // date because it converts to UTC — that causes the recordings view to
  // show the wrong day's audio.
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);

  const dates = useMemo(() => {
    const result: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push(formatLocalDate(d));
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
            // dates[] is newest→oldest. Left-chevron = move highlight left
            // = newer day = lower index.
            const idx = dates.indexOf(selectedDate);
            if (idx > 0) setSelectedDate(dates[idx - 1]);
          }}
          disabled={selectedDate === dates[0]}
          aria-label="Newer day"
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
            // Right-chevron = move highlight right = older day = higher index.
            const idx = dates.indexOf(selectedDate);
            if (idx < dates.length - 1) setSelectedDate(dates[idx + 1]);
          }}
          disabled={selectedDate === dates[dates.length - 1]}
          aria-label="Older day"
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
            <div className="px-4 sm:px-5 pt-4 pb-0">
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

              {/* Day timeline overview */}
              <DayTimeline
                segments={segments}
                offsets={offsets}
                currentTime={state.currentTime}
                totalDuration={state.totalDuration}
                onSeek={seekTo}
              />

              {/* Seek bar */}
              <SeekBar
                currentTime={state.currentTime}
                totalDuration={state.totalDuration}
                onSeek={seekTo}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-t border-border/50">
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

          {/* ── Segment list (collapsible) ── */}
          <SegmentPanel
            segments={segments}
            hourBuckets={hourBuckets}
            useGrouped={useGrouped}
            totalDuration={state.totalDuration}
            currentSegmentIdx={state.currentSegmentIdx}
            playing={state.playing}
            onSelect={(idx) => play(idx)}
          />
        </>
      )}
    </div>
  );
});
