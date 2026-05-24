# snaggr — design doc

**Date:** 2026-05-24
**Project path:** `slogging/snaggr/`
**Hosted URL:** `https://shubhamkumar27.github.io/slogging/snaggr/`

## Purpose

A small PWA (installable on iPhone home screen, also usable as a website) that
generates job-tailored resumes. A user uploads her resume once. For each job
opportunity she pastes the job description and receives a refreshed,
ATS-optimized resume plus a list of gaps (skills the JD asks for that her base
resume doesn't mention).

## Users

Few-user (the friend and the author). No real account system — each user has a
namespace gated by a passcode.

## Architecture

```
[iPhone Safari / Home-screen PWA]
        │
        ▼
[GitHub Pages: static site at /slogging/snaggr/]
   - Plain HTML/CSS/JS, no framework
   - manifest + service worker → installable PWA
        │  (fetch w/ passcode header)
        ▼
[Cloudflare Worker]
   - Validates passcode → resolves to user namespace
   - Proxies MiniMax calls (API key lives here)
   - Reads/writes Cloudflare KV
        │
        ▼
[Cloudflare KV: SNAGGR_KV]
   - users/{user}/base       → base resume JSON
   - users/{user}/history/*  → past tailored resumes
```

Static frontend on GitHub Pages, dynamic work on Cloudflare Worker + KV.
GitHub Pages can't hold secrets, so the MiniMax API key lives only in the
Worker's environment.

## Components

### Static frontend (`slogging/snaggr/`)

- `index.html` — single-page app with views:
  1. Login (passcode)
  2. Onboarding (paste/upload free-text resume → AI converts to schema → she reviews)
  3. Base Resume (read/edit, plus **Reset Base Resume** button to re-onboard)
  4. New Generation (paste JD → Generate)
  5. Result (editable preview + gap questions + PDF download)
  6. History
- `app.js` — vanilla JS. `localStorage` holds passcode + username only.
- `style.css` — mobile-first.
- `manifest.webmanifest`, `sw.js`, `icon-*.png` — installable PWA on iOS.
- `vendor/html2pdf.js` (or similar) — client-side PDF generation.

### Cloudflare Worker (`snaggr/worker/`)

- Single `worker.js`, deployed with `wrangler`.
- Endpoints:
  - `POST /auth` — validate passcode, return username.
  - `GET /resume/base` — load base resume.
  - `PUT /resume/base` — save base resume.
  - `DELETE /resume/base` — reset base resume (clears the key).
  - `POST /resume/parse` — body: `{ raw_text }` → calls MiniMax once, returns structured base-resume JSON. Used during onboarding.
  - `POST /generate` — body: `{ job_description }` → returns `{ tailored_resume, gap_questions }`, also writes to history.
  - `GET /history` — list past generations (metadata only).
  - `GET /history/:id` — fetch full past generation.
- Secrets (via `wrangler secret`): `MINIMAX_API_KEY`, `USERS_JSON` (e.g. `{"shubham":"pin1","friend":"pin2"}`).

### Cloudflare KV namespace `SNAGGR_KV`

- `users/{user}/base` → base resume JSON.
- `users/{user}/history/{iso-timestamp}` → `{ jd, tailored, gap_questions, created_at }`.

## Data: base resume schema

```json
{
  "contact": { "name": "", "email": "", "phone": "", "location": "", "links": [] },
  "summary": "",
  "experience": [
    { "company": "", "title": "", "start": "", "end": "", "location": "", "bullets": [""] }
  ],
  "education": [
    { "school": "", "degree": "", "start": "", "end": "", "details": "" }
  ],
  "skills": [""],
  "projects": [{ "name": "", "description": "", "links": [] }],
  "certifications": [""]
}
```

Tailored resumes use the same schema.

## Flows

### First-time onboarding

1. Open app → enter passcode → authenticated.
2. No base resume found → onboarding view.
3. She pastes her existing resume as free text (or uploads — v1 = paste only).
4. Frontend `POST /resume/parse` → Worker calls MiniMax with a "convert to this JSON schema" prompt.
5. She reviews the structured form, edits any wrong fields, saves.
6. `PUT /resume/base` writes to KV.

### Tailor for a job

1. App home shows "Tailor for a job" + base-resume status.
2. She pastes JD → tap **Generate**.
3. `POST /generate` → Worker loads `users/{user}/base`, builds prompt:
   - **System:** "Reframe this resume to match the JD. Reorder bullets, swap phrasing, optimize for ATS keywords. Never fabricate experience. List in `gap_questions` any JD requirements not present in the resume."
   - **User:** base resume JSON + JD text.
4. MiniMax returns `{ tailored_resume, gap_questions[] }`.
5. Worker stores result under `history/{ts}` and returns.
6. Frontend renders editable preview. Gap questions render as a yellow callout (*"JD mentions Kubernetes — do you have experience? If yes, add a bullet."*). She can edit inline, then download PDF.

### Reset base resume

In the Base Resume view, a **Reset Base Resume** button → confirm dialog → `DELETE /resume/base` → bounce back to onboarding.

## Error handling

- **No / bad passcode** → 401 from Worker; frontend redirects to Login.
- **MiniMax timeout or 5xx** → Worker retries once with exponential backoff, else 502. Frontend shows friendly message and preserves the JD input.
- **MiniMax returns malformed JSON** → Worker validates with a small schema check; on failure, re-asks once with "respond with valid JSON only"; final fallback shows raw text.
- **KV write fails** → Worker still returns the result to the frontend so the work isn't lost; logs the storage error.
- **Offline** → Service worker caches the shell so the app opens; generation requires network and shows an explicit "offline" state.

## Testing

- Worker has small unit tests for prompt construction and schema validation.
- One end-to-end smoke test: auth → save base → generate → history list.
- Manual: install on actual iPhone, confirm "Add to Home Screen" works and the app opens fullscreen.

## Implementation phases

1. **Scaffold + plumbing** — `snaggr/` folder, `index.html` stub, link from root landing, `wrangler` setup, deploy empty Worker, confirm GitHub Pages serves the subpath, confirm frontend ↔ Worker connectivity.
2. **Auth + base resume CRUD** — passcode flow, `USERS_JSON` secret, base-resume endpoints (GET/PUT/DELETE), frontend Login + Base Resume editor.
3. **MiniMax integration** — `/generate` endpoint with reframe prompt, structured JSON output, gap questions. Frontend Generate view + Result view (read-only first).
4. **Editable preview + PDF** — inline editing on the result, `html2pdf.js` for download.
5. **Onboarding parse** — `POST /resume/parse` endpoint that converts pasted free text to the schema; onboarding view in frontend.
6. **History** — list + reopen past generations.
7. **PWA polish** — manifest, service worker, icons, iOS meta tags, test "Add to Home Screen" on a real iPhone.

Phases 1–5 are MVP. 6–7 are follow-ups.

## YAGNI (explicitly out of scope for v1)

- Multiple resume templates / visual themes.
- DOCX export (PDF only).
- Multi-user signup flow / email auth.
- Resume version diffing / side-by-side compare.
- File upload parsing (PDF/DOCX) — v1 is paste-as-text only.
