## Plan

### 1. Clean up unwanted frontend pages and code
- Remove the cookie settings page from navigation and routing.
- Remove the deploy page from navigation and routing.
- Remove frontend code that calls `/api/proxy/settings` if it is only used by the deleted settings flow.
- Keep only the main usable downloader experience and essential informational pages.

### 2. Rebuild the backend around a simpler, deployable Django API
- Recheck `backend/core/urls.py`, `backend/downloader/urls.py`, Dockerfile, `render.yaml`, and backend environment defaults so Render serves real endpoints instead of “resource not found.”
- Ensure these endpoints work:
  - `GET /api/health/`
  - `POST /api/detect/`
  - `POST /api/download/`
  - `POST /api/convert/`
  - media serving for converted files
- Improve startup safety so missing optional cookie/proxy settings do not break deployment.
- Keep the backend compatible with Render Docker deploys.

### 3. Add Render-ready cookies support without an in-app settings page
- Add a backend `cookies.txt` placeholder/example file path and document how to replace it with real exported cookies before deploying.
- Configure yt-dlp to use `YTDLP_COOKIES_FILE` when set.
- Update `render.yaml` and backend docs with a clear path such as `/app/cookies.txt`.
- The app will show cookie status from health/detect results, but not include a separate cookie settings page.

### 4. Make detect/download/preview more reliable
- Update detection to return:
  - title
  - thumbnail
  - playable preview URL when available
  - best MP4 video options
  - best MP3/audio conversion option
  - clear site-specific error messages from yt-dlp
- Update direct downloads to choose safe MP4-compatible formats where possible.
- If a site only exposes separated video/audio tracks, use conversion/merge flow instead of returning unusable stream URLs.

### 5. Restrict output choices to MP4 video and MP3 audio
- Remove other audio/video target formats from backend validation and frontend controls.
- For audio conversion, always use best available audio and export MP3 with high/best practical bitrate.
- For video conversion, output MP4 only.

### 6. Handle “better quality” realistically
- The app can detect and select the best quality available from the source.
- It cannot create true higher quality than the original source provides.
- If the selected stream is low quality, the app will offer best-available MP4 conversion/merge rather than promising impossible upscaling.

### 7. Improve frontend error handling so backend failures do not blank the site
- Keep proxy routes returning user-readable JSON instead of throwing 502/504 runtime errors.
- Show actionable messages for Render sleeping, timeout, unsupported site, YouTube bot checks, missing cookies, or extraction failure.
- Make preview player display video/audio when a playable direct media URL is available, otherwise show why preview is unavailable.

### 8. Update deployment configuration and docs
- Rewrite backend README with Render deployment steps.
- Confirm `render.yaml` points to the correct service name, Docker root, health path, host, CORS origins, and public media base URL.
- Include exact env vars needed: `DJANGO_SECRET_KEY`, `API_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `PUBLIC_BASE_URL`, optional `YTDLP_COOKIES_FILE`, optional `YTDLP_PROXY`.

## Technical notes
- I will not claim support for every website. yt-dlp supports many sites, but some adult/streaming/piracy/protected sites may block cloud servers, require login, DRM, geo access, or violate platform restrictions.
- YouTube often blocks datacenter traffic; cookies and sometimes a proxy are operational requirements, not code-only fixes.
- Long conversions can exceed request timeouts on free hosting. I will improve messages and direct-download fallback, but a fully robust long-job converter would need a background queue/storage system.