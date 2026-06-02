# Resilient detect/download/convert with fallback + health check

## 1. Backend: provider abstraction with auto-fallback

**New `src/lib/providers.server.ts`** — abstraction over RapidAPI providers.
Each provider exports: `host`, `detect(url)`, `download(url, formatId)`, `convert(url, format, bitrate?)`, normalized to the response shapes our routes already return.

- **Primary**: `ytjar` (`all-media-downloader1.p.rapidapi.com`) — move existing mapping logic from `detect.ts`/`download.ts`/`convert.ts` here.
- **Fallback**: `dataFanatic` (`social-media-video-downloader.p.rapidapi.com`) — endpoints `/smvd/get/all?url=` for metadata+links; uses same `X-RapidAPI-Key`.

**New `tryProviders(op, ...args)`** helper: runs primary; on `HttpError` with upstream 403/451/410/404, retries with fallback. Other errors (timeout, 5xx, 429) propagate so the client retry can handle them. Logs which provider served the result (no URL, only hash).

**`src/lib/downloader.server.ts`**:
- Surface the upstream status code on `HttpError` (new `upstreamStatus` field) so `tryProviders` can decide.
- Keep current key handling.

**Routes** `src/routes/api/{detect,download,convert}.ts`:
- Replace direct `callRapidApi` calls with `tryProviders("detect"|"download"|"convert", …)`.
- Map upstream 403 → return HTTP 502 with friendly message: `"This source is currently blocked by the upstream provider. We tried a fallback automatically — please try a different URL or retry in a moment."`.

## 2. Backend: health-check route

**New `src/routes/api/health.ts`** — `GET /api/health`. Returns `{ status: "ok"|"degraded"|"down", providers: [{name, ok, latencyMs, status}], checkedAt }`.

- Pings each provider's lightest endpoint (HEAD or a known cheap URL like ytjar `/v2/misc/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`) with a 4s timeout.
- `ok` = primary up. `degraded` = primary down but fallback up. `down` = both fail or key missing.
- Caches result in module scope for 30s to avoid hammering RapidAPI on repeat loads.
- CORS + OPTIONS like the other routes.

## 3. Client: retry with exponential backoff

**`src/lib/api.ts`**:
- Add `withRetry<T>(fn, { attempts: 3, baseMs: 1000 })` wrapper. Delays: 1s → 2s → 4s.
- Retry **only** on network errors, HTTP 5xx, 502, 503, 504, 408, 429. Never retry 4xx (400/401/403/404/422).
- Wrap `detect`, `download`, `convert` in `withRetry`.
- Throw typed `ApiError { status, message, retriable }` instead of plain `Error` so UI can branch.
- Add `health()` call to hit `/api/health`.

## 4. Client: progress states + health banner

**`src/routes/tool.tsx`**:
- Replace boolean `loading` with a `JobState` discriminated union: `idle | preparing | detecting | retrying({attempt, nextInMs}) | ready | downloading | converting | error({message, retriable})`.
- Show a small inline progress strip above the input area:
  - "Reading source… (attempt 2 of 3, retrying in 2s)" when retrying.
  - "Fetching link…" during download.
  - "Converting to MP3…" during convert.
- On error, show the friendly message + a **Try again** button. If the error is non-retriable (4xx), include guidance ("Try a different URL or check that the link is public").
- On `/tool` mount, call `api.health()` once. If `status === "down"`, render a dismissible **Alert banner** at the top of the page: "The downloader backend is currently unavailable. Please try again in a few minutes." If `degraded`, soft banner: "Running on fallback provider — some sources may be slower."
- Use `sonner` toasts for transient retry notices (one toast per attempt).

## 5. Verification
- `GET /api/health` returns 200 JSON with provider statuses.
- With a valid URL: detect succeeds via primary; mock a 403 to confirm fallback path (smoke check by temporarily routing primary to bad path — informational only, no code stays changed).
- Network throttling / forcing 502 retries 3 times with visible backoff in UI.
- Bad URL surfaces a clear, non-retriable error.

## Out of scope
- No queueing/persistence, no auth, no rate limiting, no UI redesign beyond the banner + progress strip, no changes to footer/privacy/copyright gate.

## Prereq
`RAPIDAPI_KEY` must be subscribed to BOTH "All-in-One Downloader (ytjar)" and "Social Media Video Downloader (DataFanatic)" on RapidAPI. If only one is subscribed, health-check will mark the other as down and fallback won't help for sources only that one supports.
