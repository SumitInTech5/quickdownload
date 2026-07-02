## Plan: make the Django backend deployment path usable

### Goal
Remove the confusing `VITE_BACKEND_URL` message and make the project ready for a real Django + yt-dlp backend deployed on Render by you.

### Changes to make
1. **Add a Render blueprint**
   - Create `render.yaml` for the `backend/` Docker service.
   - Configure the health check path as `/api/health/`.
   - Define required environment variables for Render:
     - `DJANGO_SECRET_KEY`
     - `API_KEY`
     - `ALLOWED_HOSTS`
     - `CORS_ALLOWED_ORIGINS`
     - `PUBLIC_BASE_URL`

2. **Update backend docs**
   - Replace the old frontend instructions that mention:
     - `VITE_BACKEND_URL`
     - `VITE_BACKEND_API_KEY`
   - Use the current secure server-side setup instead:
     - `BACKEND_URL`
     - `BACKEND_API_KEY`
   - Add step-by-step Render deployment instructions.

3. **Add/verify backend health support**
   - Confirm the Django backend exposes `/api/health/`.
   - If needed, make the response clear enough for the frontend to display whether yt-dlp is available.

4. **Add frontend proxy health route**
   - Add `/api/proxy/health` in the TanStack app.
   - It will read `BACKEND_URL` and `BACKEND_API_KEY` server-side only.
   - If secrets are missing, it returns a clear setup-required status instead of a generic failure.

5. **Update the Convert & Download tool**
   - Replace “Set `VITE_BACKEND_URL`” with a clear message explaining that the Django backend must be deployed and connected.
   - Add a visible link/button to deployment instructions.
   - Check backend health before detect/download/convert so users see a friendly setup message first.

6. **Add a `/deploy` guide page**
   - Create an in-app checklist for deploying `backend/` on Render.
   - Include the exact values the user needs to copy between Render and Lovable secrets.
   - Keep it simple and non-technical enough to follow.

### Important limitation
I cannot create a Render account, deploy under my own account, or host the backend for you. After these changes, you still need to click through Render deployment and paste the resulting backend URL/API key into project secrets. Once that is done, I can verify and fix remaining connection issues.