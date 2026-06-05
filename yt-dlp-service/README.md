# yt-dlp microservice

A tiny FastAPI wrapper around [yt-dlp](https://github.com/yt-dlp/yt-dlp). Deploy this once on **Render free tier** (or any Docker host) and point the main Lovable app's `YTDLP_SERVICE_URL` secret at the resulting URL. The main app then uses this service for every non-YouTube source.

## Endpoints

| Method | Path        | Body                                                | Returns                                          |
|--------|-------------|-----------------------------------------------------|--------------------------------------------------|
| GET    | `/health`   | —                                                   | `{ok, yt_dlp}`                                   |
| POST   | `/info`     | `{url}`                                             | `{title, thumbnail, duration, formats:[...]}`    |
| POST   | `/resolve`  | `{url, format_id?}` or `{url, audio_format, audio_bitrate?}` | `{download_url, filename, ext}`        |

Auth: optional. If env `API_KEY` is set, clients must send `X-API-Key: <key>`.

## Deploy to Render (free, ~5 min)

1. **Fork or push this folder to a new GitHub repo.**
2. Go to https://render.com → **New +** → **Blueprint**.
3. Connect the repo. Render reads `render.yaml` and creates a free Docker web service.
4. Wait ~3 min for the first build. The service URL appears at the top — e.g. `https://yt-dlp-service-xyz.onrender.com`.
5. In Render → service → **Environment**, copy the auto-generated `API_KEY` value.
6. In Lovable → **Project Settings → Secrets**, add:
   - `YTDLP_SERVICE_URL` = `https://yt-dlp-service-xyz.onrender.com`
   - `YTDLP_SERVICE_API_KEY` = the `API_KEY` you copied
7. Test from your browser: visit `https://yt-dlp-service-xyz.onrender.com/health` — should show `{"ok":true,"yt_dlp":"..."}`.

The Lovable app picks this up at runtime — no redeploy needed.

## Deploy elsewhere (Fly.io, your VPS, Hugging Face Spaces, etc.)

Standard Docker:

```bash
docker build -t yt-dlp-service .
docker run -d -p 10000:10000 -e API_KEY=$(openssl rand -hex 16) --name ytdlp yt-dlp-service
```

## Render free-tier caveat

Free services sleep after 15 min idle. The first request after a sleep takes ~30 s to spin up. The Lovable app has a 30 s timeout on the first call and shows a "warming up" message. Subsequent requests are fast.

Upgrade to the $7/mo Starter tier to eliminate the sleep.
