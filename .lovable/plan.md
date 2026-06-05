## Goal

Replace the broken Cobalt-only backend with a **multi-tier free downloader chain**: Piped (YouTube, zero setup) + your hosted **yt-dlp microservice** (everything else, ~1800 sites) + optional Cobalt as a last resort. Ship a one-click-deploy yt-dlp service folder so you can host it free on Render.

## Why

- Cloudflare Workers (our backend) can't run yt-dlp itself — no Python, no binaries, no subprocesses.
- Piped covers YouTube with no infra at all.
- A tiny yt-dlp HTTP wrapper deployed on Render free tier covers every non-YouTube source.
- Three independent layers = "no errors" practical guarantee.

## Architecture

```text
                ┌────────────────────────────────────────────────┐
  /api/detect ──┤  is YouTube?  ── yes ──► Piped public mirrors ─┼──► streams
  /api/download│                                                │
  /api/convert │  no, or Piped failed ──► your yt-dlp service ──┼──► streams / link
                │                                                │
                │  yt-dlp failed (or not configured) ──► Cobalt  │  (only if COBALT_API_URL set)
                └────────────────────────────────────────────────┘
```

## Part 1 — yt-dlp microservice (new folder: `yt-dlp-service/`)

A separate deployable folder, NOT bundled into the main app. Contains:

- `Dockerfile` — `python:3.12-slim` base, installs `yt-dlp` + `ffmpeg` + `fastapi` + `uvicorn`.
- `app.py` — FastAPI with 3 endpoints:
  - `GET /health` → `{ok:true}`
  - `POST /info` body `{url}` → `{title, thumbnail, formats:[{format_id, ext, resolution, abr, vbr, filesize, vcodec, acodec, url}]}` (subset of `yt-dlp -j` output)
  - `POST /resolve` body `{url, format_id?}` → `{download_url, filename}` (direct upstream URL from the format)
  - Optional API-key check via `X-API-Key` header matching `API_KEY` env var (so you can lock down the service)
- `render.yaml` — Render blueprint (free Docker web service)
- `README.md` — 4-step deploy guide (fork repo → connect Render → set API_KEY env var → copy URL)

This is plain code in the repo for you to push to GitHub and point Render at. We don't deploy it ourselves.

## Part 2 — Backend changes (`src/lib/`)

### New: `src/lib/piped.server.ts`
- Detects YouTube URLs (`youtube.com`, `youtu.be`, `m.youtube.com`, `music.youtube.com`).
- Extracts video ID from any of the formats above.
- Calls `GET {pipedBase}/streams/{videoId}` against a rotating list of public Piped mirrors (`pipedapi.kavin.rocks`, `piped-api.privacy.com.de`, `pipedapi.r4fo.com`, `api.piped.yt`, etc.). User can override with `PIPED_API_URL` (comma-separated list).
- Normalizes response into our common `{title, thumbnail, streams[]}` shape.
- Returns a direct-URL `download_url` from the chosen stream (no preset translation needed — Piped exposes real format ids).

### New: `src/lib/ytdlp.server.ts`
- Reads `YTDLP_SERVICE_URL` and optional `YTDLP_SERVICE_API_KEY` from env.
- `ytdlpInfo(url)` → POST `/info`, normalize formats into our shape.
- `ytdlpResolve(url, format_id)` → POST `/resolve`, returns `{download_url}`.
- Skips silently (returns null) if `YTDLP_SERVICE_URL` is not set, so the chain falls through.

### Replace: `src/lib/cobalt.server.ts`
Keep as last-resort fallback (existing code already handles `COBALT_API_URL`). No changes to its internals.

### New: `src/lib/extractors.server.ts` (orchestrator)
- `detectAny(url)` → tries Piped (YouTube only) → yt-dlp → Cobalt presets, returns the first success.
- `resolveAny(url, format_id)` → routes based on `format_id` prefix (`piped:<id>`, `ytdlp:<id>`, `cobalt:<preset>`).
- Format IDs get prefixed in `detectAny` so `/api/download` knows which backend to call.
- Collects per-provider errors and returns the most informative one if all fail.

## Part 3 — API routes (`src/routes/api/`)

- `detect.ts` — calls `detectAny`. Returns real per-source streams (Piped/yt-dlp) when available, falls back to Cobalt's static presets only when both upstreams fail or service is unconfigured.
- `download.ts` — accepts any prefixed format_id; routes via `resolveAny`.
- `convert.ts` — for audio targets (mp3/m4a/wav/ogg) prefers yt-dlp (which extracts audio cleanly via ffmpeg) → Cobalt. For mp4 → resolve best video stream. Drops bitrate from upstream call when not supported.

## Part 4 — Secrets

Need three secrets (only `YTDLP_SERVICE_URL` is strictly required for full coverage):
- `YTDLP_SERVICE_URL` — your Render service URL (e.g. `https://yt-dlp-svc.onrender.com`)
- `YTDLP_SERVICE_API_KEY` — optional; matches the `API_KEY` env var on Render
- `PIPED_API_URL` — optional override; defaults to a built-in rotating list
- `COBALT_API_URL` — already exists; keep as last-resort

## Part 5 — UI polish (small)

`src/routes/tool.tsx`:
- When detect returns real streams (from Piped/yt-dlp), they'll show real titles, thumbnails, resolutions, file sizes — UI already supports all these fields, no changes needed.
- Add a friendly "No backend configured" notice on the tool page only when BOTH `YTDLP_SERVICE_URL` and `COBALT_API_URL` are missing and the URL isn't YouTube — via a tiny server function that reports configured-providers status (no health pings).

## What you do after I ship the code

1. Create a new GitHub repo, push the contents of `yt-dlp-service/`.
2. Render → New → Blueprint → point at that repo. Pick free tier. Wait ~3 min.
3. Render gives you `https://your-service.onrender.com`.
4. (Optional) set an `API_KEY` env var on Render to a random string.
5. In Lovable Project Settings → Secrets, set `YTDLP_SERVICE_URL` and `YTDLP_SERVICE_API_KEY`.
6. Done — YouTube works immediately via Piped (no setup), everything else via your service.

## Risks / honest caveats

- **Render free tier sleeps after 15 min inactivity** → first request after sleep takes ~30s to spin up. Subsequent requests are fast. We'll add a 25s timeout on first call and a clear "warming up" message in the UI if a request takes >5s.
- Public Piped mirrors occasionally rate-limit or go down — that's why we rotate through several, and fall back to yt-dlp.
- Some sites (DRM-protected: Netflix, Spotify premium, etc.) are unsupported by yt-dlp by design and will always error. Error messages will explicitly say "this source isn't supported".

## Files touched

- **New**: `yt-dlp-service/Dockerfile`, `yt-dlp-service/app.py`, `yt-dlp-service/requirements.txt`, `yt-dlp-service/render.yaml`, `yt-dlp-service/README.md`, `src/lib/piped.server.ts`, `src/lib/ytdlp.server.ts`, `src/lib/extractors.server.ts`
- **Edit**: `src/routes/api/detect.ts`, `src/routes/api/download.ts`, `src/routes/api/convert.ts`, `src/routes/tool.tsx` (minor — config-status notice)
- **Unchanged**: `src/lib/cobalt.server.ts` (kept as last fallback)
