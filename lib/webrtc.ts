"use client";

import { auth } from "./firebase";
import { apiFetch } from "./api";
import type { ListenTokenResponse } from "@/types/api";

export type ListenState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface ListenClientOpts {
  deviceId: string;
  shopId: string;
  onStateChange: (state: ListenState) => void;
  onAudioLevel: (level: number) => void;
  onFrequencyData?: (data: Uint8Array) => void;
  onTrack: (stream: MediaStream) => void;
  /** Fired when the server sends a listen_keepalive_prompt (idle timeout warning). */
  onIdlePrompt?: (deadlineUnixMs: number) => void;
  /** Fired when the server closes the WS with the idle-timeout close code (4408). */
  onIdleClose?: (reason: "idle_timeout") => void;
  /** Fired when the SFU notifies that the publisher (device) dropped its PC.
   * The dashboard should tear down its local track/stream and show a
   * reconnecting indicator — the next offer will arrive once the device
   * reconnects. */
  onPublisherDisconnected?: (reason: string) => void;
}

type ListenClientCloseReason =
  | "user_stopped"
  | "user_declined"
  | "prompt_ignored"
  | "hidden_too_long";

export class ListenClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private levelInterval: ReturnType<typeof setInterval> | null = null;
  private opts: ListenClientOpts;
  private disposed = false;
  private trackReceived = false;

  constructor(opts: ListenClientOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    if (this.disposed) return;
    this.opts.onStateChange("connecting");

    try {
      // 1. Get Firebase token
      const user = auth?.currentUser;
      if (!user) throw new Error("Not authenticated");
      const { getIdToken } = await import("firebase/auth");
      const firebaseToken = await getIdToken(user);

      // 2. Fetch listen token from backend
      const { sfu_url, mic_id } = await apiFetch<ListenTokenResponse>(
        `/devices/${this.opts.deviceId}/listen-token`
      );

      // 3. Open WebSocket to SFU
      const wsUrl = this.rewriteSfuUrl(sfu_url);
      await this.openWS(wsUrl);

      // 4. Join room as subscriber
      const roomId = this.opts.shopId
        ? `${this.opts.shopId}_${mic_id}`
        : mic_id;
      this.sendWS({
        type: "join",
        room_id: roomId,
        user_id: user.uid,
        role: "subscriber",
        token: firebaseToken,
        channels: ["audio"],
      });
    } catch (err) {
      if (!this.disposed) {
        this.opts.onStateChange("error");
      }
      this.cleanup();
      throw err;
    }
  }

  private openWS(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket connection failed"));
      ws.onclose = (event) => {
        if (this.disposed) return;
        // Server closed us for being idle too long — surface so the UI can
        // render a "stream closed" state instead of generic reconnect.
        if (event.code === 4408) {
          this.opts.onIdleClose?.("idle_timeout");
        }
        this.opts.onStateChange("idle");
      };
      ws.onmessage = (event) => {
        try {
          this.onMessage(JSON.parse(event.data));
        } catch { /* ignore non-JSON */ }
      };
    });
  }

  private async onMessage(msg: Record<string, unknown>): Promise<void> {
    if (this.disposed) return;

    switch (msg.type) {
      case "offer":
        await this.handleOffer(msg.sdp as string);
        break;
      case "candidate":
        if (this.pc && msg.candidate) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
          } catch { /* ignore duplicate/invalid */ }
        }
        break;
      case "error":
        console.error("[Listen] SFU error:", msg.message || msg.error);
        this.opts.onStateChange("error");
        this.cleanup();
        break;
      case "listen_keepalive_prompt": {
        // Ignore malformed prompts rather than firing with Date.now() as
        // a fallback — a zero-countdown prompt would silently self-destruct.
        if (typeof msg.deadline_unix_ms !== "number") {
          console.warn("[Listen] keepalive_prompt missing deadline_unix_ms, ignoring:", msg);
          break;
        }
        this.opts.onIdlePrompt?.(msg.deadline_unix_ms);
        break;
      }
      case "room_event": {
        // SFU notifies subscribers when the publisher's PC state changes.
        // publisher_disconnected: device's WebRTC connection failed/dropped.
        //   Drop our stale PC and surface "reconnecting" — the device will
        //   create a fresh PC on its next start_stream and the SFU will send
        //   us a new offer automatically via TriggerRenegotiation.
        const event = msg.event ?? msg.event_type;
        if (event === "publisher_disconnected") {
          const reason = (msg.state as string) || "disconnected";
          console.log("[Listen] Publisher disconnected (%s), resetting PC for re-offer", reason);
          this.resetPeerConnection();
          this.opts.onStateChange("reconnecting");
          this.opts.onPublisherDisconnected?.(reason);
        }
        break;
      }
    }
  }

  /** Tear down the RTCPeerConnection + audio graph but KEEP the WebSocket
   * alive so the SFU can push a new offer once the publisher reconnects. */
  private resetPeerConnection(): void {
    if (this.pc) {
      try { this.pc.close(); } catch { /* ignore */ }
      this.pc = null;
    }
    this.trackReceived = false;
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch { /* ignore */ }
      this.audioCtx = null;
    }
    this.gainNode = null;
    this.analyser = null;
  }

  private async handleOffer(sdp: string): Promise<void> {
    if (this.disposed) return;

    // Skip renegotiation offers if we already have a working audio track.
    // Safari rejects duplicate a=msid lines in renegotiation SDPs.
    if (this.trackReceived && this.pc) return;

    // Create PeerConnection on first offer only
    if (!this.pc) {
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      this.pc.ontrack = (event) => {
        if (this.disposed || this.trackReceived) return;
        this.trackReceived = true;

        const stream = event.streams[0] || new MediaStream([event.track]);
        this.startLevelMeter(stream);
        this.opts.onTrack(stream);
        this.opts.onStateChange("connected");
      };

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
          this.sendWS({ type: "candidate", candidate: event.candidate.toJSON() });
        }
      };
    }

    // Negotiate
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
      await this.pc.setLocalDescription();
      const ld = this.pc.localDescription;
      if (ld) {
        this.sendWS({ type: "answer", sdp: ld.sdp });
      }
    } catch (err) {
      console.warn("[Listen] SDP negotiation failed:", err);
    }
  }

  /** Audio pipeline: source → gain (+6dB boost) → destination + analyser for waveform */
  private startLevelMeter(stream: MediaStream): void {
    try {
      this.audioCtx = new AudioContext();
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();
      const source = this.audioCtx.createMediaStreamSource(stream);

      // Gain boost — ESP32 mic output is quiet, amplify for comfortable listening
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 3.0;  // +9.5 dB boost

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Route: source → gain → destination (speakers) + analyser (waveform)
      source.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);
      this.gainNode.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.levelInterval = setInterval(() => {
        if (!this.analyser || this.disposed) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 255;
          sum += v * v;
        }
        this.opts.onAudioLevel(Math.sqrt(sum / dataArray.length));
        this.opts.onFrequencyData?.(dataArray);
      }, 50);
    } catch {
      // AnalyserNode is nice-to-have, not critical
    }
  }

  private rewriteSfuUrl(sfuUrl: string): string {
    if (typeof window === "undefined") return sfuUrl;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
    if (apiBase.includes("localhost") || apiBase.includes("127.0.0.1")) {
      const port = new URL(apiBase).port || "8080";
      return `ws://localhost:${port}/ws`;
    }
    return sfuUrl;
  }

  private sendWS(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Adjust playback volume (0.0 = mute, 1.0 = default, up to ~5.0 for boost) */
  setVolume(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  /** Tell the server the user is still actively listening. Resets the server's 10-min idle window. */
  sendKeepaliveAck(): void {
    this.sendWS({ type: "listen_keepalive_ack" });
  }

  /** Courtesy graceful-close signal. Logged server-side for telemetry. Best-effort — a closing WS will silently drop the send. */
  sendClientClose(reason: ListenClientCloseReason): void {
    this.sendWS({ type: "listen_client_close", reason });
  }

  /**
   * Install (or clear) the idle-prompt callbacks after construction. Lets a
   * consumer hook subscribe to the live listen idle timeout protocol without
   * owning the ListenClient's constructor.
   */
  setIdleCallbacks(
    onIdlePrompt: ((deadlineUnixMs: number) => void) | undefined,
    onIdleClose: ((reason: "idle_timeout") => void) | undefined,
  ): void {
    this.opts.onIdlePrompt = onIdlePrompt;
    this.opts.onIdleClose = onIdleClose;
  }

  /**
   * Disconnect with an optional telemetry reason for the server log.
   * Defaults to "user_stopped" for the normal Stop-button flow. The
   * dismiss/prompt path passes "user_declined" so the server can
   * distinguish a user who said "no" from one who just clicked Stop.
   * Best-effort — send may fail if WS is already closing, that's fine.
   */
  disconnect(reason: ListenClientCloseReason = "user_stopped"): void {
    if (this.disposed) return;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendClientClose(reason);
      }
    } catch { /* ignore */ }
    this.disposed = true;
    this.cleanup();
    this.opts.onStateChange("idle");
  }

  private cleanup(): void {
    this.trackReceived = false;
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
      this.ws = null;
    }
  }
}
