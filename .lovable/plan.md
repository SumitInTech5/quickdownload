## Goal

Generate a self-contained **Django + yt-dlp backend** in a new `backend/` folder, and rewire the frontend to call it directly via a single configurable base URL. You host the Django app anywhere (Render, Railway, Fly, VPS, local); the Lovable frontend just needs its URL.

## What gets built

### 1. `backend/` — Django project (Python 3.11+)

```text
backend/
├─ manage.py
├─ requirements.txt        # django, djangorestframework, django-cors-headers, yt-dlp, gunicorn, whitenoise
├─ Dockerfile              # python:3.11-slim + ffmpeg + gunicorn
├─ .env.example            # DJANGO_SECRET_KEY, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, API_KEY
├─ README.md               # local run + deploy notes (Render/Railway/Fly)
├─ core/                   # settings, urls, wsgi
│  ├─ settings.py
│  ├─ urls.py
│  └─ wsgi.py
└─ downloader/             # the app
   ├─ views.py             # DetectView, DownloadView, ConvertView, HealthView
   ├─ services.py          # yt_dlp wrappers (extract_info, best_format, audio_convert)
   ├─ urls.py
   └─ permissions.py       # optional shared-secret header check
```

**Endpoints** (all POST, JSON, CORS-enabled):

| Path | Body | Returns |
|---|---|---|
| `POST /api/detect/` | `{url}` | `{title, thumbnail, streams:[{id,kind,container,resolution,bitrate,fileSize}]}` |
| `POST /api/download/` | `{url, format_id}` | `{download_url, filename}` (direct CDN URL from yt-dlp) |
| `POST /api/convert/` | `{url, target_format, bitrate?}` | `{download_url, filename}` (uses yt-dlp `-f bestaudio` + `postprocessors` for mp3/aac/etc.) |
| `GET  /api/health/` | — | `{ok:true, ytdlp:"<version>"}` |

**Security:** optional `X-API-Key` header checked against `API_KEY` env var so only your Lovable frontend can call it. CORS locked to `CORS_ALLOWED_ORIGINS`.

**yt-dlp usage:** `YoutubeDL({"quiet":True,"skip_download":True}).extract_info(url, download=False)` for detect; return CDN URLs directly so no video bytes flow through Django (fast, cheap, works on free tiers). Convert endpoint runs a real download+ffmpeg pass into `/tmp` and returns a signed local URL — noted in README as the one path that needs disk + ffmpeg.

### 2. Frontend rewire (Lovable side)

- Add `VITE_BACKEND_URL` and (optional) `VITE_BACKEND_API_KEY` — read via `import.meta.env` in `src/lib/api.ts`.
- Rewrite `src/lib/api.ts` to `fetch` directly against `${VITE_BACKEND_URL}/api/detect|download|convert/` with the API key header.
- **Delete** the whole rotating-extractor stack now that Django owns extraction:
  - `src/lib/extractors.server.ts`
  - `src/lib/piped.server.ts`
  - `src/lib/invidious.server.ts`
  - `src/lib/tikwm.server.ts`
  - `src/lib/cobalt.server.ts`
  - `src/routes/api/detect.ts`, `src/routes/api/download.ts`, `src/routes/api/convert.ts`
- Keep `src/lib/downloader.server.ts` helpers only if still referenced elsewhere; otherwise delete.
- `src/routes/tool.tsx` unchanged — same `api.detect / api.download / api.convert` contract.
- Update `.lovable/plan.md` to reflect Django backend.

### 3. Docs

- `backend/README.md`: `python -m venv`, `pip install -r requirements.txt`, `python manage.py migrate`, `python manage.py runserver`, plus a copy-paste Dockerfile deploy for Render/Railway/Fly.
- Short frontend-side note in root README about setting `VITE_BACKEND_URL`.

## What you do after I ship this

1. Deploy `backend/` anywhere that runs Python + Docker (Render free tier works — Dockerfile ready).
2. Set env vars on the host: `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS=https://<your-lovable-domain>`, `API_KEY=<random>`.
3. Paste the deployed URL into Lovable as `VITE_BACKEND_URL` (and `VITE_BACKEND_API_KEY` if you set one). Publish.

## Honest caveats

- yt-dlp on shared IPs (Render/Railway/Fly free tiers) gets rate-limited by YouTube — a residential proxy or cookies file is the fix; README documents both.
- The `/api/convert/` endpoint needs ffmpeg + writable `/tmp`; the Dockerfile installs ffmpeg. Serverless platforms without persistent disk (Vercel/Netlify functions) won't work for convert — Render/Railway/Fly/VPS do.
- No DRM sources (Netflix, Spotify premium) — yt-dlp can't bypass DRM.

Approve to switch to build mode and generate everything.
