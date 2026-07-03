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

## Claude update - 2026-07-03 Frontend redesign

### Summary
- **Goal**: Transform Sauna from "AI chat tool" to "personal brain-trust sauna experience" by strengthening the sauna metaphor, distillation process, and ritual ceremony.
- **Core changes**: Redesigned agent workstation cards (distillation tank + steam), added preparation ritual modal, created reusable steam/temperature components, expanded CSS variables.
- **Impact**: Visual and interaction upgrade only. No changes to routing, API calls, state management, or backend.

### Changed

**New components**:
- `apps/web/src/components/steam-particles.tsx` — Steam rising animation with density/speed controls
- `apps/web/src/components/temperature-gauge.tsx` — Sauna temperature indicator (20°C-100°C)
- `apps/web/src/components/sauna-preparation-modal.tsx` — Preheating ritual animation (1.5s transition)

**Redesigned components**:
- `apps/web/src/components/agent-card.tsx` — Replaced monitor+stand design with distillation tank + steam effects. Status animations now convey agent "presence" (idle/thinking/in_conversation). Button text changed to "进入桑拿房".
- `apps/web/src/components/lobby-overview.tsx` — Integrated preparation modal. Clicking "进入桑拿房" now triggers preheating animation before navigating to FocusRoom.

**CSS variables** (`apps/web/src/app/globals.css`):
- Added steam effects: `--sauna-steam-light/medium/dense`
- Added temperature colors: `--sauna-temp-cold/warm/hot/vhot`
- Added workstation glow: `--sauna-glow-idle/thinking/active/pulse`
- Added distillation tank: `--sauna-tank-glass/liquid/bubble`
- Night theme overrides added for all new variables

### Behavior / API impact

**No breaking changes**:
- Routing unchanged — all existing routes still work
- API calls unchanged — no new endpoints, same request/response shapes
- State management unchanged — `sauna-store.ts` untouched
- Backend unchanged — no Go code modifications required
- Data flow unchanged — streaming, Markdown rendering, plan-card parsing preserved

**Visual-only changes**:
- Agent card layout changed (tank replaces monitor)
- Preheating modal added (skippable, 1.5s duration)
- Steam particle animations added
- Status animations enhanced

### Verification

**Not run** (path issues in Windows/WSL hybrid environment prevented build verification):
- `npm run web:typecheck`
- `npm run web:lint`
- `npm run web:build`

**Files confirmed created**:
- `src/components/steam-particles.tsx` ✓
- `src/components/temperature-gauge.tsx` ✓
- `src/components/sauna-preparation-modal.tsx` ✓
- `src/components/agent-card.tsx` (overwritten) ✓

**Manual QA needed**:
- Visual regression: Check agent cards render correctly in Lobby
- Animation performance: Verify 60fps on desktop, acceptable on mobile
- Reduced motion: Verify `prefers-reduced-motion` graceful degradation
- Theme switching: Verify day/night steam colors look correct
- Preparation modal: Verify temperature animation and skip behavior

### Restart / Deploy

**Frontend**:
- Vercel redeploy **required** — new components and CSS variables need fresh build
- No environment variable changes
- No new dependencies added (Motion, Phosphor icons already installed)

**Backend**:
- No restart needed — zero backend changes

### Notes for Codex

**Design direction locked in**:
- Distillation tank + steam is the new visual language for agent workstations
- Do NOT reintroduce monitor+stand design
- Do NOT remove steam effects or temperature indicators
- Steam animations must respect `prefers-reduced-motion`

**Component usage**:
- Use `<SteamParticles />` for ambient steam effects (configurable density/speed)
- Use `<TemperatureGauge />` to display sauna temperature state
- Use `<SaunaPreparationModal />` for ritual transitions (agent entrance)

**CSS variable discipline**:
- All new colors use semantic `--sauna-*` variables
- No hardcoded hex/rgb values in components
- Night theme overrides in `:root[data-theme="night"]` scope

**Performance notes**:
- Steam particles use CSS gradients + Framer Motion (GPU-accelerated)
- Reduced motion mode shows static gradient fallback
- Temperature gauge animates via `transform` + `opacity` only

**Next phase candidates** (not yet implemented):
- FocusRoom immersive layout (remove sidebar, center chat, add steam background)
- Entry page heating animation (temperature gauge, expert convergence)
- Studio distillation tank animation (material input, progress visualization)
- Optional ambient sound system (steam hiss, wood ambiance)

**Validation blockers**:
- TypeScript/lint/build checks blocked by Windows/WSL path issues
- Recommend running full validation suite after fresh `git pull`
- If build fails, check for missing imports or type errors in new components

---

## Last handoff update

- Date: 2026-07-03
- Purpose: create Git-tracked Claude Code cross-server instructions and sanitized shared project memory.
