"use client";

import { useRef, useEffect, useCallback } from "react";

interface WaveformProps {
  playing: boolean;
  audioLevel?: number; // 0-1 real audio level from WebRTC analyser
  barCount?: number;
  className?: string;
}

export function Waveform({ playing, audioLevel = 0, barCount = 48, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const barsRef = useRef<Float32Array>(new Float32Array(barCount));
  // Initialize bars with small random values (lazy init on first draw)
  const barsInitialized = useRef(false);
  const targetsRef = useRef<Float32Array>(new Float32Array(barCount));
  const tickRef = useRef(0);
  const levelRef = useRef(audioLevel);
  levelRef.current = audioLevel;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const bars = barsRef.current;
    const targets = targetsRef.current;

    // Initialize bars with small random values on first frame
    if (!barsInitialized.current) {
      for (let i = 0; i < barCount; i++) {
        bars[i] = 0.08 + Math.random() * 0.04;
      }
      barsInitialized.current = true;
    }

    // Update targets periodically
    tickRef.current++;
    if (playing && tickRef.current % 6 === 0) {
      const level = levelRef.current;
      for (let i = 0; i < barCount; i++) {
        // Natural-looking amplitudes: center bars taller, edges shorter
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const base = (1 - dist * 0.6) * 0.85;
        // Mix real audio level with simulated randomness
        const realComponent = level * (0.8 + Math.random() * 0.4);
        const simComponent = base * (0.2 + Math.random() * 0.8);
        targets[i] = base * (level > 0.01 ? realComponent * 0.7 + simComponent * 0.3 : simComponent);
      }
    } else if (!playing && tickRef.current % 6 === 0) {
      for (let i = 0; i < barCount; i++) {
        targets[i] = 0.06 + Math.random() * 0.04;
      }
    }

    // Lerp bars toward targets
    const speed = playing ? 0.15 : 0.08;
    for (let i = 0; i < barCount; i++) {
      bars[i] += (targets[i] - bars[i]) * speed;
    }

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw bars
    const gap = 3;
    const barW = (w - gap * (barCount - 1)) / barCount;
    const midY = h / 2;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barW + gap);
      const barH = bars[i] * h * 0.9;
      const r = Math.min(barW / 2, 2);

      ctx.fillStyle = playing
        ? `oklch(0.7 0.15 160 / ${0.5 + bars[i] * 0.5})`
        : `oklch(0.45 0.03 240 / 0.4)`;
      ctx.beginPath();
      ctx.roundRect(x, midY - barH / 2, barW, barH, r);
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [playing, barCount]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
