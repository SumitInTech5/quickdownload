## What I'll build

Replace the "needs your hosted yt-dlp" path with a chain of free public APIs that require zero accounts, zero hosting, zero secrets.

### Chain (first success wins)

```text
detect(url)
├─ YouTube  → Piped mirrors (6) → Invidious mirrors (6)
├─ TikTok   → tikwm.com public API
└─ Else     → public Cobalt mirrors (4, already configured)
```

### New files

- `src/lib/invidious.server.ts` — YouTube fallback that rotates through 6 public Invidious mirrors (`inv.nadeko.net`, `invidious.nerdvpn.de`, `iv.ggtyler.dev`, `invidious.jing.rocks`, `invidious.privacyredirect.com`, `yewtu.be`). Calls `GET /api/v1/videos/{id}`, normalizes `formatStreams` + `adaptiveFormats` into our `NormalizedStream` shape. Overridable via `INVIDIOUS_API_URL`.
- `src/lib/tikwm.server.ts` — TikTok extractor. Calls `POST https://www.tikwm.com/api/` with `url` + `hd=1`. Exposes 4 streams per post (HD no-watermark, SD no-watermark, watermarked, audio mp3). Helpers `tikwmResolveBest` and `tikwmResolveAudio` for the convert path.

### Edited files

- `src/lib/extractors.server.ts` — rewire `detectAny` to the new chain order; `convertAny` routes TikTok directly through tikwm (HD mp4 / mp3 audio) and everything else through Cobalt; drop the yt-dlp branch entirely.
- `src/routes/tool.tsx` — no UI change needed; chain is always available so the "no backend configured" path is unreachable.

### Deleted

- `yt-dlp-service/` folder (already removed)
- `src/lib/ytdlp.server.ts` (already removed)

### Behavior

- YouTube URL → real titles, thumbnails, resolutions, file sizes from Piped (or Invidious on failure). Direct CDN download URLs.
- TikTok URL → 3 video variants + audio extraction, no watermark by default.
- Any other URL (Instagram, X, Reddit, SoundCloud, Vimeo, Facebook, ~1800 sites) → Cobalt presets.

### Honest caveats

- Public mirrors rate-limit and occasionally go down — rotating 4–6 endpoints per provider mitigates this but doesn't eliminate it.
- DRM sources (Netflix, Spotify premium, Disney+, etc.) will never work, by design.
- This requires zero effort from you. If you later want bulletproof reliability, self-hosting is still the only real fix.

Approve to switch to build mode and ship it.
