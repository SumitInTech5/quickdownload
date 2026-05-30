# All Video Downloader — Build Plan

A responsive React/TypeScript site (TanStack Start + Tailwind + shadcn) with full content, polished design, and a Convert & Download tool UI wired to a configurable external backend API that you'll host yourself.

## Pages (each its own route, own SEO metadata)

- `/` — Home: hero, value props, feature highlights, how-it-works teaser, FAQ teaser, CTA
- `/tool` — Convert & Download tool (URL input, detect, quality picker, format conversion, batch queue, progress)
- `/how-it-works` — 3-step explainer with diagrams
- `/faq` — Full FAQ from your spec
- `/help` — Helpline, support hours, contact form, takedown/report form
- `/terms` — Terms of Service (your draft, expanded)
- `/privacy` — Privacy Policy
- `/contact` — Contact form + email

Shared header (logo + nav + Download CTA) and footer (links, helpline, governing-law line).

## Design system

- Palette: trustworthy blues (primary), neutral grays (surfaces), bright amber/orange accent for CTAs — all defined as oklch tokens in `src/styles.css`
- Typography: Inter (body) + Space Grotesk (headings)
- Components: shadcn Button (primary "Download" filled accent, secondary "Convert" outlined), Card, Input, Tabs, Progress, Accordion (FAQ), Dialog (copyright confirmation), Sonner toasts
- Accessibility: WCAG AA contrast on all tokens, keyboard nav, ARIA labels on every form control and icon-only button, single `<main>` per route, focus-visible rings

## Tool UI behavior (`/tool`)

- URL input with paste + auto-detect button
- "Detect media" calls the backend; renders a list of available streams (resolution, bitrate, container, file size)
- Quality picker → "Download" button
- Format conversion tab: MP4→MP3/AAC/WAV, MP3→MP4 (static image), bitrate + sample-rate selects
- Batch queue: add multiple URLs, sequential progress with per-item Progress bar and status (queued/processing/done/error)
- In-browser safe preview (HTML5 `<audio>`/`<video>` against backend-returned preview URL)
- Copyright confirmation Dialog before every download/convert (required checkbox, logged with job ID)
- Job IDs shown and copyable for support
- Per-IP rate-limit UX: friendly error states when backend returns 429

## Backend integration (BYO)

You host the actual `yt-dlp` + `ffmpeg` backend (PHP, Python, Node — your choice). The frontend talks to it via a thin client.

- `VITE_API_BASE_URL` env var points at your backend
- Defined API contract (documented in `README.md`):
  - `POST /detect` `{ url }` → `{ streams: [...], preview_url, title, thumbnail }`
  - `POST /download` `{ url, stream_id, confirmed: true }` → `{ job_id }`
  - `POST /convert` `{ source, target_format, bitrate, sample_rate, confirmed: true }` → `{ job_id }`
  - `GET /jobs/:id` → `{ status, progress, download_url?, error? }` (polled)
  - `POST /report` `{ url, reason, contact }` → takedown intake
- Graceful empty state when `VITE_API_BASE_URL` is unset: tool shows "Backend not configured" panel with the API contract for your developer
- All requests include the copyright-confirmed flag; UI blocks submit without it

## Content

Full copy written for all pages from your spec — FAQ verbatim, ToS expanded from your draft (effective date placeholder, governing-law placeholder in footer), Privacy Policy aligned with "minimal retention" stance, Help page with prominent helpline placeholder + headset icon.

## Assets

Generated via image tools and stored in `src/assets/`:
- Hero image (abstract media/download motif, blue palette)
- Security/privacy icon illustration
- Support agent headset illustration
- How-it-works step icons (3)

## Out of scope (called out for clarity)

- No actual video downloading/scraping logic — that lives in your backend
- No DRM circumvention guidance anywhere in copy or code
- No PHP in this repo (runtime is a Cloudflare Worker); your backend can be PHP, hosted separately

## Technical notes

- TanStack Start file-based routes under `src/routes/`
- No server functions needed (frontend-only + external fetch)
- API client in `src/lib/api.ts` using `fetch` against `import.meta.env.VITE_API_BASE_URL`
- Zod validation on all form inputs (URL format, batch list size limits, character limits)
- Polling hook for job status (`useJobStatus(jobId)`) with exponential backoff
