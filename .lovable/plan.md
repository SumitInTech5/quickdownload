## Plan

1. **Expose YouTube cookie status from the backend**
   - Add a small backend settings/status endpoint that reports whether `YTDLP_COOKIES_FILE` is configured and whether the referenced file exists/readable.
   - Include the same cookie status in `/api/health/` so the current tool page can show it without extra setup.
   - Never expose the cookie contents or full secret values; only show safe status like `configured`, `available`, and a short path label.

2. **Add a settings flow in the app**
   - Create a Settings area reachable from the tool/deploy flow.
   - Let the user choose between:
     - referencing an existing backend file path such as `/app/cookies.txt`, and
     - uploading/pasting a `cookies.txt` file for guidance.
   - Because the actual Django backend runs on Render, the UI will provide exact Render environment variable instructions for `YTDLP_COOKIES_FILE`; it will not pretend the frontend can directly write files into Render.

3. **Show cookie usage during detection/conversion**
   - Update the backend status banner on `/tool` to display whether cookies are active.
   - Add a small status line near Detect and Convert work states so users know if yt-dlp is running with cookies or without them.

4. **Fix the 504 convert experience**
   - Convert jobs can exceed the frontend proxy/request timeout, especially on Render free instances and for long media.
   - Keep the current proxy timeout guard, but improve the returned message so the UI explains that conversion is still a long-running backend operation and suggests retrying shorter media or using direct Detect/Download.
   - Update Django `ConvertView` to surface the real conversion error type/message like Detect already does, instead of returning only `Request failed`.

5. **Document the operational fix**
   - Update backend docs and `.env.example` with the safe `YTDLP_COOKIES_FILE=/app/cookies.txt` setup and Render deployment notes.
   - Mention that a true permanent fix for long conversions is an async queue/background worker; this plan will improve visibility and error handling without adding a database-backed queue.