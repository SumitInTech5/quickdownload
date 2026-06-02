# Fix upstream 403 + add site icon

## Root cause of 403
Our proxy calls generic `/v2/info` paths against an undefined host. RapidAPI returns 403 because the request is hitting the wrong host/endpoint without the required `X-RapidAPI-Host` header. The ytjar "All-in-One Downloader" uses:

- Host: `all-media-downloader1.p.rapidapi.com`
- `GET /v2/misc/info?url=...` (metadata + formats)
- `GET /v2/video/download?url=...&format=...` (direct link)
- `GET /v2/misc/convert?url=...&format=mp3&bitrate=...`

All requests require headers `X-RapidAPI-Key` and `X-RapidAPI-Host`.

## Changes

### 1. `src/lib/downloader.server.ts`
- Hard-code `RAPIDAPI_HOST = "all-media-downloader1.p.rapidapi.com"` (no longer a secret — host is public; key stays in `RAPIDAPI_KEY`).
- Update `callRapidApi` to always send `X-RapidAPI-Key` + `X-RapidAPI-Host` and build URL as `https://${HOST}${path}?${query}`.
- Surface upstream body snippet in error message (still hashed-URL logging only) so future failures are diagnosable without leaking PII.
- Add fallback: if `RAPIDAPI_KEY` is missing, return a clean 503 "Backend not configured" instead of 502.

### 2. `src/routes/api/detect.ts`
- Change path to `/v2/misc/info`.
- Map ytjar response shape (`title`, `thumbnail`, `formats[]` with `url`, `ext`, `quality`, `filesize`, `has_audio`, `has_video`) into our `streams[]`. Use `has_video`/`has_audio` to classify kind. Pass the upstream direct `url` through as the stream id (base64-encoded) so `/api/download` can return it without a second info call.

### 3. `src/routes/api/download.ts`
- Decode the base64 `format_id` back to the upstream direct URL and return it as `download_url` immediately (no second upstream call, no buffering, no storage — matches the zero-storage policy).
- If decode fails, fall back to `/v2/video/download?url=&format=`.

### 4. `src/routes/api/convert.ts`
- Switch to `/v2/misc/convert` with `url`, `format`, optional `bitrate`.

### 5. Site header icon
- Generate a small square brand icon (download arrow over a stylized waveform, brand-colored, transparent background) via imagegen and save to `src/assets/logo-icon.png`.
- Update `src/components/SiteHeader.tsx`: replace the current text-only mark with `<img src={logoIcon} alt="" className="h-7 w-7" />` next to the existing wordmark. Keep wordmark text, sizing, and link target unchanged.

### 6. Verification
- After build, hit `/api/detect` with a YouTube URL via `stack_modern--invoke-server-function`; expect 200 with `title` + non-empty `streams[]`.
- Hit `/api/download` with one returned stream id; expect 200 with `download_url`.
- Confirm header shows new icon next to wordmark on `/`.

## Out of scope
No DB, no auth, no rate limiting, no caching, no change to copyright gate, footer, or privacy/terms copy.

## Prereq
`RAPIDAPI_KEY` secret must be set and subscribed to "All-in-One Downloader (by ytjar)" on RapidAPI. If detect still returns 403 after the fix, the key is not subscribed to that specific API on RapidAPI's dashboard — I'll surface the upstream message so it's obvious.
