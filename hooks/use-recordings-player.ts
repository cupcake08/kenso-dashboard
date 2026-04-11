"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export interface Segment {
  segment_id: string;
  start_time_unix: number;
  end_time_unix: number;
  duration_ms: number;
  status: string;
  has_audio: boolean;
}

interface PlayerState {
  playing: boolean;
  currentSegmentIdx: number;
  currentTime: number;       // seconds into the full timeline
  totalDuration: number;     // total seconds of all segments
  speed: number;
  loading: boolean;
  buffering: boolean;
}

const SPEEDS = [1, 1.5, 2] as const;
const LOOKAHEAD = 3; // Pre-decode this many segments ahead

/**
 * Gapless audio player using Web Audio API scheduled buffers.
 *
 * Technique: decode each segment to AudioBuffer via decodeAudioData(),
 * then schedule playback using the high-precision audioContext.currentTime clock.
 * Each segment is scheduled to start at the exact sample where the previous ends.
 * This gives sample-accurate gapless playback — same as Spotify/SoundCloud web players.
 */
export function useRecordingsPlayer(deviceId: string) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [state, setState] = useState<PlayerState>({
    playing: false,
    currentSegmentIdx: -1,
    currentTime: 0,
    totalDuration: 0,
    speed: 1,
    loading: false,
    buffering: false,
  });

  // Web Audio context + gain node (for volume control)
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Decoded buffer cache: segmentId → AudioBuffer
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());

  // Signed URL cache: segmentId → url (expires after 12min)
  const urlCache = useRef<Map<string, string>>(new Map());

  // Scheduled sources: array of { source, startTime, duration, segIdx }
  const scheduledRef = useRef<Array<{
    source: AudioBufferSourceNode;
    globalStart: number;  // audioCtx.currentTime when this starts
    duration: number;
    segIdx: number;
  }>>([]);

  // Timeline state
  const nextScheduleTimeRef = useRef(0); // next audioCtx.currentTime to schedule at
  const nextSegIdxRef = useRef(0);       // next segment index to schedule
  // Display clock uses performance.now() (wall clock) — decoupled from the
  // AudioContext clock so the progress bar stays smooth even when the audio
  // engine is briefly suspended (e.g. after a pause → resume transition, where
  // ctx.currentTime doesn't advance for a few frames). Audio scheduling still
  // uses ctx.currentTime for sample-accurate gapless playback.
  const playStartWallMs = useRef(0);     // performance.now() when playback started
  const playStartGlobal = useRef(0);     // global timeline offset when playback started
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const rafRef = useRef(0);

  // Cumulative offsets (seconds into full timeline for each segment start)
  const offsetsRef = useRef<number[]>([]);

  // Initialize AudioContext lazily (must be in user gesture)
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // Compute cumulative offsets when segments change
  useEffect(() => {
    let total = 0;
    const offsets: number[] = [];
    for (const seg of segments) {
      offsets.push(total);
      total += seg.duration_ms / 1000;
    }
    offsetsRef.current = offsets;
    setState((s) => ({ ...s, totalDuration: total }));
  }, [segments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      scheduledRef.current.forEach((s) => { try { s.source.stop(); } catch { /* */ } });
      ctxRef.current?.close();
    };
  }, []);

  // Fetch signed URL (cached 12 min)
  const getURL = useCallback(async (seg: Segment): Promise<string> => {
    const cached = urlCache.current.get(seg.segment_id);
    if (cached) return cached;
    const res = await apiFetch<{ url: string }>(`/devices/${deviceId}/recordings/${seg.segment_id}/url`);
    urlCache.current.set(seg.segment_id, res.url);
    setTimeout(() => urlCache.current.delete(seg.segment_id), 12 * 60 * 1000);
    return res.url;
  }, [deviceId]);

  // Fetch + decode a segment to AudioBuffer (cached)
  const decodeSegment = useCallback(async (seg: Segment): Promise<AudioBuffer | null> => {
    const cached = bufferCache.current.get(seg.segment_id);
    if (cached) return cached;

    try {
      const ctx = ensureCtx();
      const url = await getURL(seg);
      const resp = await fetch(url);
      const arrayBuf = await resp.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      bufferCache.current.set(seg.segment_id, audioBuf);
      return audioBuf;
    } catch {
      return null;
    }
  }, [ensureCtx, getURL]);

  // Find where real audio starts (skip encoder priming silence)
  const findStartOffset = useCallback((buf: AudioBuffer): number => {
    const data = buf.getChannelData(0);
    const threshold = 0.001;
    // Check first 4800 samples (~100ms at 48kHz) for silence
    const checkLen = Math.min(4800, data.length);
    for (let i = 0; i < checkLen; i++) {
      if (Math.abs(data[i]) > threshold) {
        return Math.max(0, i - 48) / buf.sampleRate; // 1ms before first audio
      }
    }
    return 0;
  }, []);

  // Stop all scheduled sources
  const stopAll = useCallback(() => {
    scheduledRef.current.forEach((s) => { try { s.source.stop(); } catch { /* */ } });
    scheduledRef.current = [];
    cancelAnimationFrame(rafRef.current);
  }, []);

  // End-of-playback detection: called from every source.onended. Fires when
  // nothing is scheduled AND we've already consumed every segment. Handles the
  // 1-segment case (where scheduleAhead's while loop never runs) uniformly
  // with the N-segment case. Safe to call multiple times.
  const maybeEndPlayback = useCallback(() => {
    if (!playingRef.current) return;
    if (scheduledRef.current.length > 0) return;
    if (nextSegIdxRef.current < segments.length) return;
    playingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setState((s) => ({
      ...s,
      playing: false,
      currentTime: s.totalDuration,
      currentSegmentIdx: Math.max(0, segments.length - 1),
    }));
  }, [segments]);

  // Schedule the next N segments ahead of the current playback position
  const scheduleAhead = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx || !playingRef.current) return;

    const segs = segments;
    let idx = nextSegIdxRef.current;

    while (idx < segs.length && idx < nextSegIdxRef.current + LOOKAHEAD) {
      const seg = segs[idx];
      if (!seg.has_audio) { idx++; nextSegIdxRef.current = idx; continue; }

      const buf = await decodeSegment(seg);
      if (!buf || !playingRef.current) return; // Stopped while decoding

      const startOffset = findStartOffset(buf);
      const trueDuration = buf.duration - startOffset;

      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.value = speedRef.current;
      source.connect(gainRef.current!);

      // Schedule at exact time
      if (nextScheduleTimeRef.current < ctx.currentTime) {
        nextScheduleTimeRef.current = ctx.currentTime + 0.01;
      }

      const scheduledAt = nextScheduleTimeRef.current;
      source.start(scheduledAt, startOffset);

      // Advance schedule time by duration adjusted for speed
      const playDuration = trueDuration / speedRef.current;
      nextScheduleTimeRef.current = scheduledAt + playDuration;

      scheduledRef.current.push({
        source,
        globalStart: scheduledAt,
        duration: playDuration,
        segIdx: idx,
      });

      // When this source ends, clean up and maybe schedule more.
      // maybeEndPlayback handles the terminal case uniformly for 1-seg and N-seg.
      source.onended = () => {
        scheduledRef.current = scheduledRef.current.filter((s) => s.source !== source);
        if (!playingRef.current) return;
        scheduleAhead();
        maybeEndPlayback();
      };

      idx++;
      nextSegIdxRef.current = idx;
    }

    setState((s) => ({ ...s, buffering: false }));
  }, [segments, decodeSegment, findStartOffset, maybeEndPlayback]);

  // Time update loop (runs via rAF). Uses performance.now() — NOT ctx.currentTime —
  // so the display clock keeps ticking even when the AudioContext is briefly
  // suspended or in a resume transition. The loop self-perpetuates as long as
  // playingRef.current is true; pause and maybeEndPlayback clear the ref so the
  // loop dies cleanly on its next frame.
  const updateTime = useCallback(() => {
    if (!playingRef.current) return;

    const elapsed = ((performance.now() - playStartWallMs.current) / 1000) * speedRef.current;
    const globalTime = playStartGlobal.current + elapsed;

    // Find which segment we're in
    const offsets = offsetsRef.current;
    let currentIdx = 0;
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (globalTime >= offsets[i]) { currentIdx = i; break; }
    }

    setState((s) => ({
      ...s,
      currentTime: Math.min(globalTime, s.totalDuration),
      currentSegmentIdx: currentIdx,
    }));

    rafRef.current = requestAnimationFrame(updateTime);
  }, []);

  // Play from a specific global time position
  const playFrom = useCallback((globalSeconds: number) => {
    const ctx = ensureCtx();
    stopAll();

    // Find which segment this falls into
    const offsets = offsetsRef.current;
    let segIdx = 0;
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (globalSeconds >= offsets[i]) { segIdx = i; break; }
    }

    playingRef.current = true;
    playStartWallMs.current = performance.now();
    playStartGlobal.current = globalSeconds;
    nextSegIdxRef.current = segIdx;
    nextScheduleTimeRef.current = ctx.currentTime + 0.01;

    setState((s) => ({ ...s, playing: true, currentSegmentIdx: segIdx, buffering: true }));

    // The first segment may need a seek offset within it
    const localOffset = globalSeconds - offsets[segIdx];

    // Special handling for first segment (start mid-segment)
    (async () => {
      const seg = segments[segIdx];
      if (!seg?.has_audio) { nextSegIdxRef.current = segIdx + 1; scheduleAhead(); return; }

      const buf = await decodeSegment(seg);
      if (!buf || !playingRef.current) return;

      const startOffset = findStartOffset(buf) + localOffset;
      const trueDuration = (buf.duration - startOffset);

      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.value = speedRef.current;
      source.connect(gainRef.current!);

      const scheduledAt = nextScheduleTimeRef.current;
      source.start(scheduledAt, Math.min(startOffset, buf.duration - 0.01));

      const playDuration = trueDuration / speedRef.current;
      nextScheduleTimeRef.current = scheduledAt + playDuration;

      scheduledRef.current.push({ source, globalStart: scheduledAt, duration: playDuration, segIdx });

      source.onended = () => {
        scheduledRef.current = scheduledRef.current.filter((s) => s.source !== source);
        if (!playingRef.current) return;
        scheduleAhead();
        maybeEndPlayback();
      };

      nextSegIdxRef.current = segIdx + 1;
      setState((s) => ({ ...s, buffering: false }));

      // Pre-decode ahead
      scheduleAhead();
    })();

    rafRef.current = requestAnimationFrame(updateTime);
  }, [segments, ensureCtx, stopAll, decodeSegment, findStartOffset, scheduleAhead, maybeEndPlayback, updateTime]);

  const play = useCallback((fromIdx?: number) => {
    const idx = fromIdx ?? 0;
    const globalTime = offsetsRef.current[idx] ?? 0;
    playFrom(globalTime);
  }, [playFrom]);

  const pause = useCallback(() => {
    playingRef.current = false;
    stopAll();
    // Suspend context to free resources
    ctxRef.current?.suspend();
    setState((s) => ({ ...s, playing: false }));
  }, [stopAll]);

  const toggle = useCallback(() => {
    if (playingRef.current) {
      pause();
    } else {
      // Resume from current position
      playFrom(state.currentTime > 0 ? state.currentTime : 0);
    }
  }, [pause, playFrom, state.currentTime]);

  const seekTo = useCallback((globalSeconds: number) => {
    const clamped = Math.max(0, Math.min(globalSeconds, state.totalDuration - 0.1));
    if (playingRef.current) {
      playFrom(clamped);
    } else {
      // Just update position without playing
      const offsets = offsetsRef.current;
      let idx = 0;
      for (let i = offsets.length - 1; i >= 0; i--) {
        if (clamped >= offsets[i]) { idx = i; break; }
      }
      setState((s) => ({ ...s, currentTime: clamped, currentSegmentIdx: idx }));
    }
  }, [playFrom, state.totalDuration]);

  const skip = useCallback((seconds: number) => {
    seekTo(state.currentTime + seconds);
  }, [seekTo, state.currentTime]);

  const cycleSpeed = useCallback(() => {
    const currentIdx = SPEEDS.indexOf(speedRef.current as typeof SPEEDS[number]);
    const next = SPEEDS[(currentIdx + 1) % SPEEDS.length];
    speedRef.current = next;

    // Update all currently scheduled sources
    scheduledRef.current.forEach((s) => {
      s.source.playbackRate.value = next;
    });

    setState((s) => ({ ...s, speed: next }));
  }, []);

  const loadDate = useCallback(async (date: string) => {
    stopAll();
    playingRef.current = false;
    bufferCache.current.clear();
    urlCache.current.clear();
    setState((s) => ({ ...s, loading: true, playing: false, currentSegmentIdx: -1, currentTime: 0 }));

    try {
      const data = await apiFetch<Segment[]>(`/devices/${deviceId}/recordings?date=${date}`);
      const playable = (data ?? []).filter((s) => s.has_audio).sort((a, b) => a.start_time_unix - b.start_time_unix);
      setSegments(playable);
    } catch {
      setSegments([]);
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [deviceId, stopAll]);

  return {
    segments,
    state,
    play,
    pause,
    toggle,
    seekTo,
    skip,
    cycleSpeed,
    loadDate,
  };
}
