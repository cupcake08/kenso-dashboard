# Fix API Shape Mismatches + Wire Listen Live via WebRTC

> **Goal:** Align dashboard TypeScript types with Go backend JSON shapes, and add real WebRTC audio streaming to the Listen Live tab.

**Architecture:** Fix `apiFetch` to unwrap the `{"data": ...}` envelope. Update all TypeScript types to match backend snake_case + unix timestamps. Add a `useListenLive` hook that handles WebSocket signaling + RTCPeerConnection + Web Audio playback. The SFU uses a server-initiated SDP offer flow.

**Tech Stack:** Next.js, pion/webrtc (SFU), RTCPeerConnection API, Web Audio API

---

## Task 1: Fix apiFetch to unwrap `data` envelope

**Files:**
- Modify: `lib/api.ts`

The Go backend wraps all responses in `{"data": ...}`. The current `apiFetch` returns `res.json()` directly.

- Change `apiFetch<T>` to unwrap: `const json = await res.json(); return json.data as T;`
- This single change fixes the envelope issue for all endpoints

## Task 2: Fix TypeScript types to match Go backend

**Files:**
- Modify: `types/api.ts`

Update all interfaces to match exact Go backend JSON tags:

```ts
// Device: mic_id, last_seen_unix (int64), status is "active"/"soft_deleted"
// WindowSummary: started_at_unix, duration_ms, flag_count, no highlights/summary in list
// WindowDetail: new type with flags, highlights, utterances, summary
// CreditsResponse: { balance, plan, history[] } (not balance+transactions)
// Transaction: created_at_unix, no balance_after, optional window_id
// PlanResponse: mostly matches (plan, billing_cycle, price_per_month)
// ListenTokenResponse: new type { token, sfu_url, mic_id, expires_at_unix }
```

## Task 3: Add response normalizer utilities

**Files:**
- Modify: `lib/api.ts` (add mapper functions)

Add helpers to convert backend shapes to dashboard-friendly shapes:
- `unixToISO(unix: number): string` — convert unix int to ISO string
- `normalizeDevice(raw): Device` — map mic_id→device_id, last_seen_unix→last_seen_at, status mapping
- `normalizeWindow(raw): WindowSummary` — map started_at_unix, duration_ms→duration_minutes, flag_count→flags_count
- `normalizeCredits(raw): { balance, transactions }` — restructure from backend shape
- `normalizeTransaction(raw): Transaction` — map created_at_unix→created_at

## Task 4: Update all page components

**Files:**
- Modify: `app/dashboard/devices/page.tsx` — use normalizeDevice on each item
- Modify: `app/dashboard/devices/[id]/page.tsx` — use normalizers, remove demo shape assumptions
- Modify: `app/dashboard/usage/page.tsx` — restructure for credits response shape
- Modify: `app/dashboard/settings/page.tsx` — plan response is direct (already matches mostly)

## Task 5: Create WebRTC client

**Files:**
- Create: `lib/webrtc.ts`

WebSocket signaling + RTCPeerConnection for subscriber role:
1. Fetch listen token from `GET /v2/dashboard/devices/{id}/listen-token`
2. Open WebSocket to `sfu_url`
3. Send join message: `{type:"join", room_id, user_id, role:"subscriber", token, channels:["audio"]}`
4. Receive SDP offer from SFU
5. Create RTCPeerConnection with Opus codec
6. Set remote description, create answer, send back
7. Handle trickle ICE candidates
8. On `ontrack`: create Web Audio AudioContext, play stream
9. Handle disconnect/reconnect
10. Cleanup on unmount

## Task 6: Create useListenLive hook + wire to Listen tab

**Files:**
- Create: `hooks/use-listen.ts`
- Modify: `app/dashboard/devices/[id]/page.tsx`

Hook manages WebRTC lifecycle:
- `connect(deviceId)` — fetches token, opens WS, starts SDP exchange
- `disconnect()` — closes PC + WS, stops audio
- `state: "idle" | "connecting" | "connected" | "error"`
- `audioLevel: number` — for waveform visualization

Wire into Listen tab:
- Play button calls `connect()` / `disconnect()`
- Status shows hook state
- Waveform receives real audio level data when connected
- Falls back to simulated waveform when not connected
