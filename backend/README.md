# Downloader Backend (Django + yt-dlp)

REST API used by the Lovable frontend. Handles `detect`, `download`, and `convert`.

## Endpoints

All under `/api/`. Bodies are JSON. If `API_KEY` is set, include header `X-API-Key: <value>`.

| Method | Path              | Body                                          | Returns                                     |
|--------|-------------------|-----------------------------------------------|---------------------------------------------|
| GET    | `/api/health/`    | —                                             | `{ok, ytdlp}`                               |
| POST   | `/api/detect/`    | `{url}`                                       | `{title, thumbnail, previewUrl, streams[]}` |
| POST   | `/api/download/`  | `{url, format_id}`                            | `{download_url, filename}`                  |
| POST   | `/api/convert/`   | `{url, target_format, bitrate?}`              | `{download_url, filename}`                  |

Allowed `target_format`: `mp3`, `aac`, `wav`, `ogg`, `m4a`, `mp4`.

## Local development

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # then edit
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Test it:

```bash
curl http://localhost:8000/api/health/
curl -X POST http://localhost:8000/api/detect/ \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

You need **ffmpeg** on your PATH for `/api/convert/` (audio extraction, mp4 merging).

## Deploy

### Render (Docker, free tier)

1. Push this repo to GitHub.
2. Render → **New +** → **Web Service** → pick your repo.
3. Environment: **Docker**, root directory: `backend/`.
4. Add env vars from `.env.example` (at minimum: `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS=<your-render-host>`, `CORS_ALLOWED_ORIGINS=https://<your-lovable-domain>`, `PUBLIC_BASE_URL=https://<your-render-host>`).
5. Deploy. Health check path: `/api/health/`.

### Railway / Fly / any Docker host

Same Dockerfile. Set the same env vars. Bind to `$PORT`.

## Wire up the Lovable frontend

In your Lovable project, set these Vite env vars:

```
VITE_BACKEND_URL=https://<your-django-host>
VITE_BACKEND_API_KEY=<same value as backend API_KEY, or leave unset if API_KEY is empty>
```

Publish. That's it.

## Notes on reliability

- YouTube rate-limits shared cloud IPs. If you see 429s, either supply cookies (`YTDLP_COOKIES_FILE=/app/cookies.txt` — mount a cookies.txt exported from your browser) or route through a residential proxy (`YTDLP_PROXY`).
- `/api/convert/` writes to `MEDIA_ROOT` (`/tmp/ytdlp-media` by default). On platforms without persistent disk, files vanish on redeploy — fine for immediate downloads, not for later re-serves.
- No DRM sources (Netflix, Spotify premium, etc.) — yt-dlp cannot bypass DRM.
