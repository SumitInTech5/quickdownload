# Downloader Backend (Django + yt-dlp)

REST API used by the All Video Downloader frontend. It runs Django, yt-dlp, and ffmpeg in Docker so media extraction/conversion happens outside the frontend hosting runtime.

## Endpoints

All endpoints are under `/api/`. Job endpoints require `X-API-Key: <API_KEY>` in production.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/` | — | backend live JSON |
| GET | `/api/health/` | — | `{ok, ytdlp, auth_required, authenticated, cookies, proxy}` |
| POST | `/api/detect/` | `{url}` | `{title, thumbnail, previewUrl, previewKind, streams[], cookies}` |
| POST | `/api/download/` | `{url, format_id}` | `{download_url, filename}` |
| POST | `/api/convert/` | `{url, target_format, bitrate?}` | `{download_url, filename}` |

Allowed `target_format`: `mp3` for audio and `mp4` for video.

## Deploy on Render

1. Push this project to GitHub.
2. In Render, choose **New + → Blueprint**.
3. Select the GitHub repo that contains this project.
4. Render reads the root `render.yaml` and creates a Docker web service from `backend/`.
5. After creation, open the service environment variables and update:
   - `ALLOWED_HOSTS` to your exact Render host, for example `all-video-downloader-backend-0klz.onrender.com`.
   - `PUBLIC_BASE_URL` to `https://all-video-downloader-backend-0klz.onrender.com`.
   - `CORS_ALLOWED_ORIGINS` to your Lovable published domain and preview domain if needed.
6. Deploy the service.
7. Confirm both `https://your-service.onrender.com/` and `https://your-service.onrender.com/api/health/` return JSON.

## YouTube cookies

YouTube may block shared cloud hosts with bot checks. To let yt-dlp reuse an authorized browser session:

1. Export a Netscape-format `cookies.txt` file from a browser profile that can view YouTube.
2. Replace `backend/cookies.txt` with the exported file before deploying, or mount a private Render secret file at the same path. Do not commit personal cookies to a public repo.
3. Set this Render environment variable, already included in `render.yaml`:

```text
YTDLP_COOKIES_FILE=/app/cookies.txt
```

4. Redeploy the backend and check `/api/health/`. The response includes `cookies.available: true` when the file exists, is readable, and contains cookie rows.

Cookies help with YouTube bot checks, but they do not bypass DRM and they do not remove request-time limits for very long conversions.

## Connect the Lovable frontend

Set these **project runtime secrets** in Lovable, not Vite variables:

```text
BACKEND_URL=https://all-video-downloader-backend-0klz.onrender.com
BACKEND_API_KEY=<same value as Render API_KEY>
```

Do not use `VITE_BACKEND_URL` or `VITE_BACKEND_API_KEY`. The frontend now calls same-origin proxy routes, and the proxy injects `BACKEND_API_KEY` server-side so it is not exposed in browser JavaScript.

## Local development

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Test it:

```bash
curl http://localhost:8000/api/health/
curl -X POST http://localhost:8000/api/detect/ \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: <API_KEY>' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## Privacy and storage behavior

- Detect and download resolution do not store user media.
- Convert uses `/tmp/ytdlp-media` by default for transient ffmpeg output. On Render free services this is ephemeral and not persistent storage.
- The app should only process public URLs that the user confirms they own or have permission to download.

## Reliability notes

- YouTube can rate-limit shared cloud IPs. If this happens, replace `backend/cookies.txt` with a real export and optionally add `YTDLP_PROXY` on the backend host.
- Long conversions can exceed frontend/proxy request windows. For production-grade long jobs, move conversion into a queue/background worker and return a job ID immediately.
- DRM sources are not supported. yt-dlp cannot and should not bypass DRM.
- Render free services may sleep. The first request after sleeping can take longer.
