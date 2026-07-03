## Connect the deployed backend

You've deployed the Django backend on Render. I'll wire it up to the frontend by saving the two values as project secrets so the server-side proxy routes can reach it.

### Steps
1. Save `BACKEND_URL` = `https://all-video-downloader-backend-0klz.onrender.com` as a project secret (via `set_secret`).
2. Save `BACKEND_API_KEY` = the provided key as a project secret (via `set_secret`).
3. Hit `/api/proxy/health` to confirm the backend responds `ok: true` and yt-dlp version is reported.
4. If health passes, run a quick detect against a known public URL to confirm end-to-end extraction works. If it fails, report the exact upstream status/message.

### Notes
- These go into runtime secrets (server-side only), not `VITE_*`, so the API key never ships to the browser.
- Since you pasted the API key in chat, rotate it in Render → Environment after we confirm the connection works, then update the secret with `update_secret`.
- No code changes required — the proxy routes and health banner are already in place.