"use client";

import { useRef, useState, useCallback } from "react";
import { ListenClient, type ListenState } from "@/lib/webrtc";

export function useListenLive(deviceId: string) {
  const clientRef = useRef<ListenClient | null>(null);
  const [state, setState] = useState<ListenState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);

  const connect = useCallback(() => {
    // Tear down any existing connection
    clientRef.current?.disconnect();

    const client = new ListenClient({
      deviceId,
      onStateChange: setState,
      onAudioLevel: setAudioLevel,
      onTrack: () => {}, // Audio plays via Web Audio API internally
    });

    clientRef.current = client;
    client.connect().catch(() => {
      // Error state already handled by client
    });
  }, [deviceId]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setState("idle");
    setAudioLevel(0);
  }, []);

  const toggle = useCallback(() => {
    if (state === "idle" || state === "error") {
      connect();
    } else {
      disconnect();
    }
  }, [state, connect, disconnect]);

  return { state, audioLevel, connect, disconnect, toggle };
}
