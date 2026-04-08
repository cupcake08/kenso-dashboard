"use client";

import { useRef, useState, useCallback } from "react";
import { ListenClient, type ListenState } from "@/lib/webrtc";

export function useListenLive(deviceId: string, shopId: string) {
  const clientRef = useRef<ListenClient | null>(null);
  const [state, setState] = useState<ListenState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);

  const connect = useCallback(() => {
    clientRef.current?.disconnect();

    const client = new ListenClient({
      deviceId,
      shopId,
      onStateChange: setState,
      onAudioLevel: setAudioLevel,
      onTrack: () => {},
    });

    clientRef.current = client;
    client.connect().catch(() => {});
  }, [deviceId, shopId]);

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
