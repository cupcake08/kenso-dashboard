"use client";

import { auth } from "./firebase";
import { apiFetch } from "./api";
import type { ListenTokenResponse } from "@/types/api";

export type ListenState = "idle" | "connecting" | "connected" | "error";

interface ListenClientOpts {
  deviceId: string;
  shopId: string;
  onStateChange: (state: ListenState) => void;
  onAudioLevel: (level: number) => void;
  onTrack: (stream: MediaStream) => void;
}

export class ListenClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelInterval: ReturnType<typeof setInterval> | null = null;
  private opts: ListenClientOpts;
  private disposed = false;

  constructor(opts: ListenClientOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    if (this.disposed) return;
    this.opts.onStateChange("connecting");

    try {
      // 1. Get Firebase token for SFU auth
      const user = auth?.currentUser;
      if (!user) throw new Error("Not authenticated");
      const { getIdToken } = await import("firebase/auth");
      const firebaseToken = await getIdToken(user);

      // 2. Fetch listen token to get SFU URL and mic ID
      const { token: _token, sfu_url, mic_id } =
        await apiFetch<ListenTokenResponse>(
          `/devices/${this.opts.deviceId}/listen-token`
        );

      // 3. Open WebSocket to SFU
      // For local dev, rewrite production SFU URL to localhost
      const wsUrl = this.rewriteSfuUrl(sfu_url);
      await this.openWS(wsUrl);

      // 4. Send join message
      // room_id format: {shopID}_{micID} — matches ESP32 publisher format
      // If shopId is not available, try mic_id alone (SFU may resolve)
      const roomId = this.opts.shopId ? `${this.opts.shopId}_${mic_id}` : mic_id;
      this.sendWS({
        type: "join",
        room_id: roomId,
        user_id: user.uid,
        role: "subscriber",
        token: firebaseToken,
        channels: ["audio"],
      });

      // 5. Wait for SDP offer from SFU (server-initiated)
      // The rest happens in onMessage
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

      ws.onclose = () => {
        if (!this.disposed) {
          this.opts.onStateChange("idle");
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.onMessage(msg);
        } catch {
          // ignore non-JSON messages
        }
      };
    });
  }

  private async onMessage(msg: Record<string, unknown>): Promise<void> {
    if (this.disposed) return;

    switch (msg.type) {
      case "offer": {
        // SFU sends SDP offer — create PeerConnection and answer
        await this.handleOffer(msg.sdp as string);
        break;
      }
      case "candidate": {
        // Trickle ICE candidate from SFU
        if (this.pc && msg.candidate) {
          try {
            await this.pc.addIceCandidate(
              new RTCIceCandidate(msg.candidate as RTCIceCandidateInit)
            );
          } catch {
            // ignore duplicate or invalid candidates
          }
        }
        break;
      }
      case "room_status": {
        // Initial room info from SFU — connection progressing
        break;
      }
      case "error": {
        console.error("SFU error:", msg.message);
        this.opts.onStateChange("error");
        this.cleanup();
        break;
      }
    }
  }

  private async handleOffer(sdp: string): Promise<void> {
    if (this.disposed) return;

    // Create PeerConnection with STUN servers
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Handle audio tracks from SFU
    this.pc.ontrack = (event) => {
      if (this.disposed) return;
      const stream = event.streams[0];
      if (stream) {
        this.setupAudio(stream);
        this.opts.onTrack(stream);
        this.opts.onStateChange("connected");
      }
    };

    // Send ICE candidates to SFU via WebSocket
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.sendWS({
          type: "candidate",
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Set remote description (SFU's offer) and create answer
    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    // Send answer back to SFU
    this.sendWS({
      type: "answer",
      sdp: answer.sdp,
    });
  }

  private setupAudio(stream: MediaStream): void {
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    source.connect(this.analyser);

    // Start polling audio level for waveform
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.levelInterval = setInterval(() => {
      if (!this.analyser || this.disposed) return;
      this.analyser.getByteFrequencyData(dataArray);
      // RMS of frequency data, normalized to 0-1
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 255;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      this.opts.onAudioLevel(rms);
    }, 50);
  }

  /** Rewrite production SFU URL to local dev if needed */
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

  disconnect(): void {
    this.disposed = true;
    this.cleanup();
    this.opts.onStateChange("idle");
  }

  private cleanup(): void {
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
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
