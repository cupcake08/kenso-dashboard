"use client";

import { useRef, useEffect, useCallback, type MutableRefObject } from "react";

interface WaveformProps {
  playing: boolean;
  frequencyDataRef?: MutableRefObject<Uint8Array | null>;
  barCount?: number;
  className?: string;
}

/**
 * Real-time audio waveform driven by actual frequency data from WebRTC AnalyserNode.
 * When no frequency data is available, shows a flat idle state.
 * When playing, bars map directly to frequency bins — what you see IS what the mic hears.
 */
export function Waveform({ playing, frequencyDataRef, barCount = 48, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const barsRef = useRef<Float32Array>(new Float32Array(barCount));
  const sizeRef = useRef({ w: 0, h: 0 });
  const prefersReducedMotion = useRef(false);

  // Check reduced motion preference once
  useEffect(() => {
    if (typeof window !== "undefined") {
      prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Only resize canvas when container size actually changes (avoids reflow per frame)
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const newW = Math.round(rect.width * dpr);
    const newH = Math.round(rect.height * dpr);
    if (sizeRef.current.w !== newW || sizeRef.current.h !== newH) {
      canvas.width = newW;
      canvas.height = newH;
      sizeRef.current = { w: newW, h: newH };
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const bars = barsRef.current;
    const freqData = frequencyDataRef?.current;

    // Smoothing factor — lower for reduced motion (less animation)
    const smoothing = prefersReducedMotion.current ? 0.8 : 0.3;

    // Map frequency bins to bars — mirrored from center outward
    const halfBars = Math.ceil(barCount / 2);
    if (playing && freqData && freqData.length > 0) {
      const binCount = freqData.length;
      const binsPerBar = Math.max(1, Math.floor(binCount / halfBars));
      for (let i = 0; i < halfBars; i++) {
        let sum = 0;
        const start = i * binsPerBar;
        const end = Math.min(start + binsPerBar, binCount);
        for (let j = start; j < end; j++) {
          sum += freqData[j];
        }
        const avg = sum / (end - start) / 255;
        const centerIdx = halfBars - 1 - i;
        const leftIdx = centerIdx;
        const rightIdx = barCount - 1 - centerIdx;
        bars[leftIdx] += (avg - bars[leftIdx]) * smoothing;
        if (rightIdx !== leftIdx) bars[rightIdx] += (avg - bars[rightIdx]) * smoothing;
      }
    } else {
      // Idle: settle bars to a subtle baseline
      for (let i = 0; i < barCount; i++) {
        bars[i] += (0.05 - bars[i]) * 0.08;
      }
    }

    ctx.clearRect(0, 0, w, h);

    const gap = 2;
    const barW = Math.max(1, (w - gap * (barCount - 1)) / barCount);
    const midY = h / 2;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barW + gap);
      const barH = Math.max(bars[i] * h * 0.9, 2);
      const r = Math.min(barW / 2, barH / 2, 2);

      const alpha = playing ? 0.4 + bars[i] * 0.6 : 0.15;
      // Emerald when playing, muted neutral when idle — fallback for browsers without oklch
      ctx.fillStyle = playing
        ? `rgba(52, 211, 153, ${alpha})`
        : `rgba(148, 163, 184, ${alpha})`;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, midY - barH / 2, barW, barH, r);
      } else {
        // Fallback for older browsers
        ctx.rect(x, midY - barH / 2, barW, barH);
      }
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [playing, barCount, frequencyDataRef]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-label={playing ? "Live audio waveform" : "Audio waveform — idle"}
      role="img"
    />
  );
}
