# Django + yt-dlp backend

The Lovable frontend calls a self-hosted Django backend that runs yt-dlp.

## Layout

- `backend/` — Django project (see `backend/README.md`).
- `src/lib/api.ts` — thin client. Reads `VITE_BACKEND_URL` and optional `VITE_BACKEND_API_KEY`, calls `${BACKEND}/api/detect|download|convert/`.

## Frontend env

```
VITE_BACKEND_URL=https://<your-django-host>
VITE_BACKEND_API_KEY=<optional, must match backend API_KEY if set>
```

## Deploy

Any Docker host (Render/Railway/Fly/VPS). Dockerfile installs ffmpeg for the convert path.
