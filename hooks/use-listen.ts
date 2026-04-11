"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ListenClient, type ListenState } from "@/lib/webrtc";

const VOLUME_KEY = "kenso-listen-volume";

/**
 * Hook for live audio listening.
 *
 * Usage in component:
 *   const { audioRef, state, toggle } = useListenLive(deviceId, shopId);
 *   return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
 *
 * The <audio> element MUST be rendered in JSX (DOM-attached).
 */
export function useListenLive(deviceId: string, shopId: string) {
  const clientRef = useRef<ListenClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<ListenState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const frequencyDataRef = useRef<Uint8Array | null>(null);

  // Persisted volume (default 3.0 = +9.5dB boost for quiet ESP32 mic)
  const [volume, setVolumeState] = useState(() => {
    if (typeof window === "undefined") return 3.0;
    const saved = localStorage.getItem(VOLUME_KEY);
    return saved ? parseFloat(saved) : 3.0;
  });

  // Cleanup on unmount (user navigates away)
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  // Cleanup on browser tab close
  useEffect(() => {
    const onUnload = () => clientRef.current?.disconnect();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const connect = useCallback(() => {
    clientRef.current?.disconnect();

    // ── AUDIO UNLOCK (must happen synchronously in user gesture context) ──
    // Muted play() always succeeds and "unlocks" the element for future unmuted playback.
    const el = audioRef.current;
    if (el) {
      el.muted = true;
      el.play().catch(() => {});
    }

    const client = new ListenClient({
      deviceId,
      shopId,
      onStateChange: setState,
      onAudioLevel: setAudioLevel,
      onFrequencyData: (data: Uint8Array) => { frequencyDataRef.current = data; },
      onTrack: (stream: MediaStream) => {
        const el = audioRef.current;
        if (!el) return;
        // Set stream on <audio> as fallback — primary playback is via Web Audio GainNode.
        // Keep <audio> muted to avoid double-playback (Web Audio handles amplified output).
        el.srcObject = stream;
        el.muted = true;
        el.play().catch(() => {});
      },
    });

    clientRef.current = client;
    client.connect().catch(() => {});
  }, [deviceId, shopId]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    setState("idle");
    setAudioLevel(0);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
    clientRef.current?.setVolume(v);
  }, []);

  // Sync volume when client reconnects
  useEffect(() => {
    clientRef.current?.setVolume(volume);
  }, [state, volume]);

  const toggle = useCallback(() => {
    if (state === "idle" || state === "error") {
      connect();
    } else {
      disconnect();
    }
  }, [state, connect, disconnect]);

  return { audioRef, state, audioLevel, frequencyDataRef, volume, setVolume, connect, disconnect, toggle, clientRef };
}
