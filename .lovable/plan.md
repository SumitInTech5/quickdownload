## Goal

Get the tool reliably detecting + downloading audio/video again by replacing the broken RapidAPI backend (returning 403 "not subscribed") with the open-source **Cobalt API**, removing the 3-attempt retry loop and the health banner, and cleaning up dead code so the site stops throwing errors.

## Why the current build fails

Network logs show every upstream call returning `403 "You are not subscribed to this API."` from both `ytjar` and `dataFanatic`. The `RAPIDAPI_KEY` secret is set but the account has no subscription to either host, so retries and fallback cannot help. We need a different backend.

## Backend choice: Cobalt API (no-auth public instance)

Cobalt is an open-source media-extraction API (YouTube, TikTok, Instagram, X, Reddit, SoundCloud, Twitch, etc.). Call shape:

```
POST {COBALT_BASE}/
Headers: Accept: application/json, Content-Type: application/json
Body: { url, downloadMode: "auto"|"audio"|"mute", audioFormat: "mp3"|"m4a"|..., videoQuality: "1080"|"720"|... }
Response: { status: "tunnel"|"redirect"|"picker"|"error", url?, filename?, picker?[] }
```

`COBALT_BASE` will be a configurable env var (`COBALT_API_URL`) defaulting to a known no-auth public instance. User can swap it later if the chosen instance rate-limits us — no code change required.

> Note: Cobalt does NOT return a metadata index upfront. So "Detect" becomes a UX pattern where we present **a fixed set of quality/format presets** for the pasted URL; "Download" makes the actual Cobalt call for the chosen preset. This is more robust than enumerating per-source format IDs and works uniformly for every supported source.

## Changes

### 1. New backend module: `src/lib/cobalt.server.ts`
- `cobaltCall(payload)` — POST to `COBALT_API_URL`, 20s timeout, maps non-2xx and Cobalt `status:"error"` into our `HttpError` with friendly messages.
- `cobaltResolve(url, preset)` — translates a preset id (e.g. `video-best`, `video-720`, `audio-mp3`, `audio-m4a`) into Cobalt payload, returns `{ download_url, filename }`.
- Handles `tunnel` and `redirect` statuses (both yield a direct URL). `picker` → take first item. `error` → throw friendly message based on Cobalt error code (e.g. `error.api.content.video.unavailable` → "This video is private or unavailable").

### 2. Rewrite API routes
- `src/routes/api/detect.ts` — no longer calls upstream. Returns a static list of stream presets derived from URL (always: Video best, Video 1080p, Video 720p, Audio MP3, Audio M4A). No upstream call → instant, never errors except on invalid URL.
- `src/routes/api/download.ts` — accepts `{ url, format_id }` where `format_id` is one of the preset ids, calls `cobaltResolve`, returns `{ download_url }`.
- `src/routes/api/convert.ts` — routes audio conversion presets through Cobalt's `downloadMode:"audio"` + `audioFormat` (mp3/aac→m4a/wav/ogg). Removes bitrate/sampleRate fields from upstream call (Cobalt doesn't expose them); UI keeps the selects but they become informational.
- `src/routes/api/health.ts` — **deleted**.

### 3. Delete dead code
- `src/lib/providers.server.ts` — deleted.
- `src/lib/downloader.server.ts` — keep validation/CORS/`handle()`/`HttpError` helpers; remove `callRapidApi` and `RAPIDAPI_HOST`.

### 4. Remove retry logic — `src/lib/api.ts`
- Delete `withRetry`, `RetryOptions`, `RetryHooks` (single-attempt only).
- Keep `ApiError` + `FRIENDLY_BY_STATUS` (improved messages for Cobalt-specific errors).
- `api.detect/download/convert` become plain single-shot calls.
- Delete `api.health`.

### 5. Simplify `src/routes/tool.tsx`
- Remove `HealthBanner` component and its render.
- Remove `RetryHooks`, `makeHooks`, `useJobPhase` retry/attempt state — collapse to simple `loading | error | done` states.
- `ProgressStrip` simplifies to a spinner + label (no attempt counter).
- Remove "Try again" button (errors just show inline; user retries by clicking Detect/Download again).
- BatchPanel loses retry awareness; single attempt per item.

### 6. Secret
- Add `COBALT_API_URL` secret (optional — we ship a default public instance URL as fallback in code, but env override lets user point to their own/another mirror if the default ever degrades).
- We can also delete `RAPIDAPI_KEY` afterwards (you do that in Project Settings → Secrets; no code dependency remains).

## Out of scope
- Self-hosting a Cobalt instance. We'll use a public no-auth mirror; if it rate-limits us heavily, the fix is to set `COBALT_API_URL` to a different mirror (or your own) — no code change.
- Per-format bitrate/sample-rate control on video (Cobalt picks best for the chosen quality).

## Risks
- Public Cobalt mirrors can rate-limit or go offline without notice. If that happens, swap `COBALT_API_URL`. Symptoms will appear as clean "Source temporarily unavailable" errors, not crashes.
- Some sources (e.g. age-restricted YouTube, private posts) are unsupported by any backend; we'll surface Cobalt's specific error message instead of a generic failure.

## Files touched
- **New**: `src/lib/cobalt.server.ts`
- **Edit**: `src/routes/api/detect.ts`, `src/routes/api/download.ts`, `src/routes/api/convert.ts`, `src/lib/downloader.server.ts`, `src/lib/api.ts`, `src/routes/tool.tsx`
- **Delete**: `src/lib/providers.server.ts`, `src/routes/api/health.ts`
