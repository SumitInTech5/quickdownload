
# Plan

## 1. Backend — RapidAPI proxy with hardening

Add three server routes under `src/routes/api/` that proxy to a RapidAPI "all-in-one" downloader. No media is read, buffered, or stored on our server — we only return upstream JSON (metadata + direct upstream URLs the user's browser fetches).

- `src/routes/api/detect.ts` — POST `{ url, copyright_confirmed }` → returns title, thumbnail, available streams.
- `src/routes/api/download.ts` — POST `{ url, format_id, copyright_confirmed }` → returns `{ download_url, expires_at }` (a direct, time-limited upstream link). Client triggers browser download from that URL; nothing transits our worker.
- `src/routes/api/convert.ts` — POST `{ url, target_format, bitrate?, copyright_confirmed }` → forwards to RapidAPI conversion endpoint, returns `{ download_url, expires_at }`.

Shared helper `src/lib/downloader.server.ts`:
- Zod schemas for inputs (URL max 2048 chars, format whitelist, bitrate whitelist).
- `validatePublicUrl(url)`:
  - parses with `new URL()`
  - protocol must be `http:` or `https:`
  - hostname is not an IP literal
  - hostname is not localhost / `.local` / `.internal`
  - rejects private ranges (10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7)
  - optional host allow-list via env `ALLOWED_HOSTS` (comma-sep)
- `requireCopyright(flag)` — throws 400 if not exactly `true`.
- `callRapidApi(path, body)` — fetch wrapper using `RAPIDAPI_KEY` + `RAPIDAPI_HOST`, 15s timeout, no-store.
- `logEvent(event)` — minimal structured `console.log` with timestamp, route, hashed URL (sha-256, first 12 hex), status. **No raw URL, no IP, no user agent, no media** kept anywhere.

Each route:
- OPTIONS handler + CORS headers (same-origin in practice, included for safety).
- Validates body with Zod → `validatePublicUrl` → `requireCopyright` → calls upstream → returns JSON.
- On error returns `{ error }` with proper status; never leaks upstream error bodies verbatim.

Secrets to add via `add_secret`: `RAPIDAPI_KEY`, `RAPIDAPI_HOST` (e.g. `all-media-downloader1.p.rapidapi.com` — user can adjust).

## 2. Client wiring

- `src/lib/api.ts` — repoint to local routes (`/api/detect`, `/api/download`, `/api/convert`); drop `VITE_API_BASE_URL`. Remove `isBackendConfigured` (always true now) and update callers.
- `src/routes/tool.tsx`:
  - Add required **Copyright confirmation checkbox**: "I confirm I own this content or have the right to download it." Disable submit until checked. Send `copyright_confirmed: true` on every call.
  - Remove `BackendNotice` block (backend now built-in).
  - On `download`/`convert` success, do `window.location.assign(download_url)` (or `<a download>` click) so the upstream link triggers a browser download — file never touches our server.

## 3. Cleanup — files & routes to remove

- Delete `src/routes/contact.tsx`.
- Remove "Contact" entries from `SiteHeader.tsx` nav (if any) and `SiteFooter.tsx`.
- Delete unused imports/dead code in `api.ts` (already partly done).
- Verify no orphan imports of `contact` or `isBackendConfigured` remain.

Skipping: shadcn primitives left in place (low value to prune).

## 4. Footer text tweak

`src/components/SiteFooter.tsx`: replace
`Governed by the laws of [Your Jurisdiction].` → `Governed by the Laws.`

## 5. Privacy/Terms touch-ups

- `src/routes/privacy.tsx`: add one line confirming "We do not store your downloaded media. Requests are proxied; only minimal anonymized logs (hashed URL, timestamp, status) are kept."
- `src/routes/terms.tsx`: ensure copyright-confirmation requirement is mentioned in the user-obligations section.

## 6. Verify

- Build passes; no unresolved imports.
- `/tool` shows copyright checkbox, submit disabled until checked.
- `/contact` 404s (and isn't linked anywhere).
- Footer shows "Governed by the Laws."
- Manually hit `/api/detect` with a bad URL → 400; without `copyright_confirmed` → 400; with valid URL + flag → 200 (once RapidAPI key set).

## Out of scope

- Rate limiting (per platform rules).
- Auth — none required for this flow.
- Persisting any job history or media.

## Technical notes

- Routes run on Cloudflare Workers — proxy only, no yt-dlp/ffmpeg locally. Media bytes never enter the worker.
- Logging via `console.log` only; no DB writes.
- Copyright flag is enforced server-side; the client checkbox is a UX layer, not the security boundary.
