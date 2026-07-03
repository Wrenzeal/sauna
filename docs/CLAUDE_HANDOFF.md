# Claude handoff for Sauna

This file is the Git-tracked cross-server handoff for Claude Code and other coding agents. It intentionally avoids local secrets and machine-only state.

## Current project state

- Product: Sauna, a personal AI brain-trust workspace based on nuwa-skill style advisor prompts.
- Frontend: `apps/web`, Next.js 16 App Router, React 19, Tailwind CSS v4, Zustand, Motion.
- Backend: `apps/backend`, Go Gin API with Clean Architecture-style package boundaries.
- Database: PostgreSQL with `pgvector` and `pgcrypto`.
- Cache: DragonFlyDB or Redis-compatible cache.
- LLM integration: OpenAI-compatible Base URL, API key, model discovery, test chat, and streaming chat completions.
- Production frontend target: `https://sauna.wrenzeal.top` on Vercel.
- Production API target: `https://api.sauna.wrenzeal.top/api/v1` behind Nginx.
- Local backend port: `19588`.

## What is implemented

### Frontend

- `/` animated entry gate with “什么是 Sauna” introduction.
- `/lobby` 智囊大厅 with default advisor workstations and recent sessions.
- `/focus-room/[sessionId]` VIP 桑拿房 with Markdown rendering, streaming status, plan-JSON task cards, consultation history, rename, and delete.
- `/settings` model/provider settings page for user-owned OpenAI-compatible providers.
- `/studio` 蒸馏车间 shell for creating/distilling advisors.
- `/board-meeting` disabled MVP placeholder for future 董事会桑拿.
- Fresh day/night theme system with animated toggle in `apps/web/src/components/theme-toggle.tsx`.
- Semantic theme variables in `apps/web/src/app/globals.css`.

### Backend

- Email-code auth with development logger and SMTP abstraction for production.
- Provider config storage with encrypted API keys and masked responses.
- Public default advisors seeded from markdown nuwa-skill files.
- User consultation sessions, turns, messages, SSE event persistence, and stream replay shape.
- Session rename and delete APIs.
- Studio job/private agent foundation for nuwa-skill based distillation.
- BoardMeeting remains disabled in MVP.

## Recent important changes

Latest known commits before this handoff:

- `ebf01ab` Make Sauna feel fresh across day and night
- `7c34f83` Unify Sauna around a warm cedar visual identity
- `a3bff3a` Contain FocusRoom scrolling and render plan cards
- `712f272` Keep first FocusRoom send from remounting the page
- `01b40b3` Require real email verification before production login

Most recent visual state:

- The warm cedar UI was replaced by a fresh mint/aqua day theme and deep teal night theme.
- `ThemeToggle` persists `sauna-theme` in `localStorage` and uses View Transition circular reveal when supported.
- `RootLayout` injects a small theme init script before hydration to avoid theme flash.
- Core components use semantic `--sauna-*` variables instead of hardcoded palette values.

## How to run

Install dependencies:

```bash
npm install
npm --prefix apps/web install
cd apps/backend && go mod download
```

Start local backend from repo root:

```bash
npm run dev:start
```

Stop local backend:

```bash
npm run dev:stop
```

Run local frontend if needed:

```bash
npm run web:dev
```

Backend health check:

```bash
curl http://127.0.0.1:19588/health
```

## Environment notes

- Do not commit `.env`, `.env.local`, API keys, SMTP credentials, production database URLs, or provider keys.
- Use `.env.example` as the safe template.
- Frontend Vercel should only need `NEXT_PUBLIC_SAUNA_API_BASE_URL=https://api.sauna.wrenzeal.top/api/v1`.
- Backend secrets, database URL, Redis/DragonFly URL, SMTP settings, and `SAUNA_SECRET_KEY` belong on the backend/VPS only.

## Validation matrix

Frontend-only change:

```bash
npm run web:typecheck
npm run web:lint
npm run web:build
git diff --check
```

Backend-only change:

```bash
npm run backend:test
git diff --check
```

Full change:

```bash
npm run backend:test
npm run web:typecheck
npm run web:lint
npm run web:build
git diff --check
```

Known build note: `npm run web:build` may show an existing Next.js warning about multiple lockfiles and inferred workspace root. This warning is not currently treated as a build failure.

## Design rules to preserve

- Keep visible product labels Chinese where specified in `docs/PRD_CONTEXT.md`.
- Use English code identifiers.
- Keep UI colors routed through semantic `--sauna-*` variables.
- Do not reintroduce hardcoded warm cedar colors or mixed black/white/green palettes.
- Keep route transitions and theme transitions reduced-motion friendly.
- Preserve chat streaming, Markdown rendering, plan-card parsing, provider settings, session history, rename, and delete behavior.

## Backend rules to preserve

- Keep Clean Architecture separation: domain, repository, service/usecase, and handler boundaries.
- Keep prompt assembly and LLM provider calls outside HTTP handlers.
- Keep provider keys encrypted at rest and never returned as plaintext.
- Keep PostgreSQL and `pgvector` as the vector storage path. Do not add a third-party vector database.
- Logged-in user consultations should use the user's configured provider when required.

## Open work and risks

- File upload, parser, embedding job, and full RAG ingestion are future work.
- External nuwa-skill worker/agent-pool architecture is not fully implemented.
- BoardMeeting is still disabled for MVP.
- Manual browser QA is still useful after visual changes, especially across day/night themes and mobile layouts.
- Vercel deployment requires correct public API environment variable.
- Production login requires working SMTP configuration on the backend.

## Collaboration protocol for Claude Code

When starting on the other server:

1. Pull latest Git state.
2. Read `CLAUDE.md`, this file, `docs/PRD_CONTEXT.md`, and `README.md`.
3. State what you believe the current project state is before editing.
4. Make focused changes.
5. Run the relevant validation commands.
6. Update this handoff if the shared project state changes.
7. Commit only safe source/docs changes. Never commit secrets or local runtime files.

## Last handoff update

- Date: 2026-07-03
- Purpose: create Git-tracked Claude Code cross-server instructions and sanitized shared project memory.
