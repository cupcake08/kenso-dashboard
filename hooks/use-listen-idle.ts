"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { MutableRefObject } from "react";
import type { ListenClient } from "@/lib/webrtc";

// How long the dashboard tab can be hidden continuously before the client
// proactively closes the stream. Independent of the server's 10-minute timer —
// this kicks in much earlier for the "user walked away" case.
const HIDDEN_GRACE_MS = 60 * 1000;

export type IdleClosedReason = "idle_timeout" | "hidden_too_long" | null;

export type IdleState = {
  /** True while the keepalive prompt card-takeover is showing. */
  promptActive: boolean;
  /** Absolute deadline from the server's prompt, in ms since epoch. */
  deadlineUnixMs: number | null;
  /** Seconds remaining until the prompt's deadline. Null when no prompt is active. */
  countdownSeconds: number | null;
  /** Set after the stream is closed due to idle timeout or tab-hidden grace. */
  idleClosedReason: IdleClosedReason;
};

// Used by acknowledge / dismiss / countdown-expired / visibility-hidden to
// clear the takeover UI. idleClosedReason is intentionally preserved so the
// caller can set it separately (or leave it null on ack).
const clearPromptFields = (prev: IdleState): IdleState => ({
  ...prev,
  promptActive: false,
  deadlineUnixMs: null,
  countdownSeconds: null,
});

/**
 * Listens for the server's idle keepalive prompt and owns the UX state around
 * it: a 30-second countdown, acknowledge/dismiss actions, and an independent
 * 60-second tab-hidden visibility guard that closes the stream early when the
 * user has clearly walked away.
 *
 * The hook installs callbacks by mutating the live `ListenClient.opts` object.
 * This works because `ListenClient.onMessage` reads `this.opts.onIdlePrompt`
 * on each message, so late-installed callbacks are picked up correctly.
 */
export function useListenIdle(
  clientRef: MutableRefObject<ListenClient | null>,
  isConnected: boolean
): {
  state: IdleState;
  acknowledge: () => void;
  dismiss: () => void;
} {
  const [state, setState] = useState<IdleState>({
    promptActive: false,
    deadlineUnixMs: null,
    countdownSeconds: null,
    idleClosedReason: null,
  });

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset when a fresh connection begins ─────────────────────────────────
  // Must run BEFORE the prompt-install effect so the reset doesn't clobber
  // a prompt that arrives immediately after connect.
  useEffect(() => {
    if (isConnected) {
      setState({
        promptActive: false,
        deadlineUnixMs: null,
        countdownSeconds: null,
        idleClosedReason: null,
      });
    }
  }, [isConnected]);

  // ── Install prompt/close callbacks on the ListenClient ───────────────────
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !isConnected) return;

    const onIdlePrompt = (deadlineUnixMs: number) => {
      setState((prev) => ({
        ...prev,
        promptActive: true,
        deadlineUnixMs,
        countdownSeconds: Math.max(0, Math.ceil((deadlineUnixMs - Date.now()) / 1000)),
      }));
    };

    const onIdleClose = (reason: "idle_timeout") => {
      setState((prev) => ({
        ...prev,
        promptActive: false,
        deadlineUnixMs: null,
        countdownSeconds: null,
        idleClosedReason: reason,
      }));
    };

    client.setIdleCallbacks(onIdlePrompt, onIdleClose);

    return () => {
      try {
        client.setIdleCallbacks(undefined, undefined);
      } catch { /* client may already be torn down */ }
    };
  }, [clientRef, isConnected]);

  // ── Countdown ticker ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.promptActive || state.deadlineUnixMs === null) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const deadline = state.deadlineUnixMs;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining === 0) {
        // Countdown expired — client proactively closes.
        const client = clientRef.current;
        client?.sendClientClose("prompt_ignored");
        setState((prev) => ({ ...clearPromptFields(prev), idleClosedReason: "idle_timeout" }));
        return;
      }
      setState((prev) => (prev.countdownSeconds === remaining ? prev : { ...prev, countdownSeconds: remaining }));
    };

    tick(); // initial value
    countdownIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [state.promptActive, state.deadlineUnixMs, clientRef]);

  // ── Visibility guard ─────────────────────────────────────────────────────
  // Tab hidden continuously for HIDDEN_GRACE_MS → close the stream early.
  // Tab becomes visible again within grace → cancel the pending close.
  useEffect(() => {
    if (!isConnected) return;

    const handleVisibility = () => {
      if (document.hidden) {
        if (hiddenTimeoutRef.current) clearTimeout(hiddenTimeoutRef.current);
        hiddenTimeoutRef.current = setTimeout(() => {
          const client = clientRef.current;
          client?.sendClientClose("hidden_too_long");
          client?.disconnect();
          setState((prev) => ({ ...clearPromptFields(prev), idleClosedReason: "hidden_too_long" }));
        }, HIDDEN_GRACE_MS);
      } else {
        if (hiddenTimeoutRef.current) {
          clearTimeout(hiddenTimeoutRef.current);
          hiddenTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (hiddenTimeoutRef.current) {
        clearTimeout(hiddenTimeoutRef.current);
        hiddenTimeoutRef.current = null;
      }
    };
  }, [isConnected, clientRef]);

  // ── User actions ─────────────────────────────────────────────────────────
  const acknowledge = useCallback(() => {
    const client = clientRef.current;
    client?.sendKeepaliveAck();
    setState(clearPromptFields);
  }, [clientRef]);

  const dismiss = useCallback(() => {
    const client = clientRef.current;
    client?.sendClientClose("user_declined");
    client?.disconnect();
    setState(clearPromptFields);
  }, [clientRef]);

  return { state, acknowledge, dismiss };
}
