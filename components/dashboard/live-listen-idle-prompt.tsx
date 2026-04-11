"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveListenIdlePromptProps {
  countdownSeconds: number;
  onAcknowledge: () => void;
  onDismiss: () => void;
}

/**
 * Card takeover shown inside the live listen card when the server's idle
 * keepalive prompt arrives. The user has ~30 seconds to click "Keep listening"
 * or the stream is closed. Audio continues playing during the prompt.
 */
export function LiveListenIdlePrompt({
  countdownSeconds,
  onAcknowledge,
  onDismiss,
}: LiveListenIdlePromptProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the primary action so keyboard users can ack with Enter.
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // Keyboard shortcuts: Enter = keep listening, Escape = stop.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onAcknowledge();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onAcknowledge, onDismiss]);

  const mm = Math.floor(countdownSeconds / 60);
  const ss = countdownSeconds % 60;
  const timeLabel = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <motion.div
      role="alertdialog"
      aria-labelledby="idle-prompt-heading"
      aria-describedby="idle-prompt-body"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className="flex flex-col items-center justify-center gap-6 p-8 text-center"
    >
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-status-pending/15 text-status-pending"
      >
        <Radio className="h-6 w-6" />
      </motion.div>

      <div className="space-y-2 max-w-xs">
        <h3 id="idle-prompt-heading" className="text-lg font-semibold text-foreground">
          Still listening?
        </h3>
        <p id="idle-prompt-body" className="text-sm text-muted-foreground">
          Live audio will stop in{" "}
          <span
            aria-live="assertive"
            className="font-mono tabular-nums font-semibold text-foreground"
          >
            {timeLabel}
          </span>{" "}
          if there&apos;s no response.
        </p>
      </div>

      <div className="flex gap-3">
        <Button ref={primaryRef} onClick={onAcknowledge} aria-label="Keep listening">
          Keep listening
        </Button>
        <Button variant="outline" onClick={onDismiss} aria-label="Stop listening">
          Stop
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground/60">Audio continues playing</p>
    </motion.div>
  );
}
