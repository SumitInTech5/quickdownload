# Django + yt-dlp backend

The Lovable frontend calls a self-hosted Django backend that runs yt-dlp.

## Layout

- `backend/` — Django project (see `backend/README.md`).
- `src/routes/api/proxy/*.ts` — server-side proxy that injects the backend API key.
- `src/lib/api.ts` — browser client. Calls the same-origin `/api/proxy/*` routes.

## Server env (set in Lovable project secrets, NOT VITE_)

```
BACKEND_URL=https://<your-django-host>
BACKEND_API_KEY=<must match backend API_KEY>
```

The key is intentionally not `VITE_`-prefixed so it stays on the server.

## Deploy

Any Docker host (Render/Railway/Fly/VPS). Dockerfile installs ffmpeg for the convert path.
