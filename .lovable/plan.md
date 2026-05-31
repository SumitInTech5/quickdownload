# Plan

## 1. Help page — keep only AI assistance
`src/routes/help.tsx` becomes a thin shell that renders `<AiHelpChat />` inside `PageShell` + `PageHeader`. Remove:
- Helpline card (phone, email)
- "Report content / takedown" card and the entire `ReportForm` function
- Unused imports (`Headphones`, `Mail`, `Phone`, `MessageSquareWarning`, `Loader2`, `Input`, `Label`, `Textarea`, `Button`, `Card*`, `z`, `toast`, `useState`, `api`, `isBackendConfigured`)
- Updated meta description: "Chat with our AI assistant for help."

## 2. Strip emails / phones / contact links everywhere
- **`src/components/SiteFooter.tsx`**: remove the `Headphones` phone line; drop the entire "Support" column's `Contact` link; keep `Help` link only. Remove `Headphones` import.
- **`src/routes/contact.tsx`**: keep route + page shell, but remove the email/phone card entirely and remove the email field from the form. Form becomes name + message only (no real submit backend — same simulated toast as today). Drop `Mail`, `Phone` imports.
- **`src/routes/privacy.tsx`**: rewrite the "Your rights" block to say requests are handled via the in-app AI assistant on `/help` (no email address). Remove the line about storing user email under "Data we collect" since accounts aren't part of this build.
- **`src/routes/terms.tsx`**: section 9 — replace "notify registered users by email" with "post a notice on this page".
- Leave `Contact` in the header? It's not in nav. The header has Home/Tool/How it works/FAQ/Help. No change there.

## 3. Backend for downloads/audio
User confirmed they will host yt-dlp elsewhere. No backend code added in this repo. The existing client `src/lib/api.ts` already targets `VITE_API_BASE_URL` with the right `/detect`, `/download`, `/convert`, `/jobs/:id` contract. I will:
- Keep `api.ts` but remove the `report` method (no longer used).
- Update the in-app `BackendNotice` on `/tool` to drop mention of `/report`.
- Add a short "Connecting your backend" section to `README.md` documenting env var + endpoint contract so the user can wire their externally hosted server.

The AI chat backend (`src/routes/api/chat.ts` + `src/lib/ai-gateway.server.ts`) stays — it powers the only Help feature.

## 4. Remove unnecessary files
Confirmed unused after the changes above:
- `src/lib/api/example.functions.ts` — template stub, not imported anywhere
- Nothing else in `src/` is orphaned (verified imports). shadcn UI components stay — pruning them risks breaking future edits and is low value.

## 5. Verify
- After edits, the build should pass with no unresolved imports.
- Visit `/help`, `/contact`, `/privacy`, `/terms` and footer in preview to confirm no emails/phones remain.
- Confirm `/tool` notice text no longer references `/report`.

## Out of scope
- No new server route for downloading (Cloudflare Worker can't run yt-dlp; user is hosting it themselves).
- No deletion of shadcn UI primitives.
- No header/nav restructuring beyond what's listed.
