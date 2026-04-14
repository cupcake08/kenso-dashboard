"use client";
import { useEffect, useRef } from "react";
import { animate } from "animejs";

type Props = {
  values: number[];
  height?: number;
  className?: string;
};

export function Sparkline({ values, height = 40, className = "" }: Props) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!pathRef.current || values.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const len = pathRef.current.getTotalLength();
    pathRef.current.style.strokeDasharray = `${len}`;
    pathRef.current.style.strokeDashoffset = `${len}`;
    const anim = animate(pathRef.current, {
      strokeDashoffset: 0,
      duration: 800,
      ease: "outQuad",
    });
    return () => { anim.pause(); };
  }, [values]);

  if (values.length === 0) {
    return <div style={{ height }} className={className} aria-hidden />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, -1);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return { x, y };
  });

  // Smooth path using quadratic bezier midpoints.
  const d = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    const cy = (prev.y + p.y) / 2;
    return `${acc} Q ${prev.x},${prev.y} ${cx},${cy} T ${p.x},${p.y}`;
  }, "");

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={{ height, width: "100%" }}
      preserveAspectRatio="none"
      role="img"
      aria-label="Sentiment sparkline"
    >
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
