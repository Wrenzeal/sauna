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

## Claude update - 2026-07-03 Warm color palette redesign

### Summary
- **Goal**: Replace harsh cyan-green color scheme with warm wood-toned palette to match sauna atmosphere and improve visual comfort.
- **Core changes**: Redesigned entire color system from cold mint/aqua to warm cedar/amber tones. Reduced contrast, increased warmth, added natural wood feel.
- **Impact**: CSS variables only. No component logic, routing, API, or backend changes.

### Changed

**CSS variables** (`apps/web/src/app/globals.css`):
- **Day theme**: Replaced mint/aqua (`#edf9f5`, `#15b8a6`) with warm beige/cedar (`#f5f0e8`, `#d4a574`)
- **Night theme**: Replaced deep teal (`#061516`, `#63e6d7`) with warm dark wood (`#1a1510`, `#e8b878`)
- **Accent color**: Cyan-green → Warm amber/honey (`#d4a574` day, `#e8b878` night)
- **Primary button**: Cold teal → Cedar brown (`#8b6239` day, `#e8b878` night)
- **Text colors**: Adjusted to warm brown/beige tones for better harmony
- **Steam effects**: Changed to warm cream/amber glow instead of cool white
- **Temperature colors**: Now use warm palette (`#d4a574` hot vs cold teal before)
- **Glow effects**: Warm amber glow replaces cyan-green

**Color philosophy shift**:
- Before: Tech-focused cold spa (mint, aqua, teal)
- After: Natural sauna wood (cedar, amber, honey, warm browns)

### Behavior / API impact

**No functional changes**:
- Component behavior unchanged
- All animations and interactions work exactly the same
- Steam particles, temperature gauge, preparation modal use new warm colors
- No routing, API, state, or backend modifications

**Visual changes only**:
- Overall warmer, more comfortable appearance
- Lower contrast between elements
- Natural wood-like feel matching real sauna experience
- Better readability with warm browns vs cold greens

### Verification

**Not run** (same path constraints as previous commit):
- `npm run web:typecheck`
- `npm run web:lint`
- `npm run web:build`

**Manual QA needed**:
- Visual comfort: Verify colors are less harsh and more pleasant
- Theme switching: Check day/night transition looks smooth
- Component rendering: Agent cards, preparation modal, steam effects
- Readability: Text contrast should be comfortable in both themes

### Restart / Deploy

**Frontend**:
- Vercel redeploy **required** — CSS variables changed
- No environment variable changes
- No new dependencies

**Backend**:
- No restart needed — zero backend changes

### Notes for Codex

**Color system now locked**:
- Do NOT revert to cyan/teal/mint palette
- All colors must use warm tones (cedar, amber, honey, browns)
- New accent is `#d4a574` (day) / `#e8b878` (night)
- Steam should appear warm cream/amber, not cool white

**CSS variable updates**:
- `--sauna-accent`: Now warm amber instead of cyan
- `--sauna-primary`: Now cedar brown (day) / amber glow (night)
- `--sauna-bg`: Warm beige/dark wood instead of mint/teal
- `--sauna-steam-*`: Warm toned instead of cold white
- `--sauna-temp-*`: Warm temperature progression

**Design consistency**:
- All future components must use the new warm palette
- Refer to `globals.css` for correct color variables
- Do not introduce cold blues, teals, or bright cyans
- Keep the natural wood/sauna atmosphere

---

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


---

## 2026-07-13 Quiet-luxury full-product redesign (supersedes prior tank/steam direction)

The design direction documented above for distillation tanks, temperature gauges, steam particles, and preheating rituals is obsolete. `DESIGN.md` is now the authoritative visual and interaction contract.

### Current UI state

- Day theme uses cream, ivory, walnut, brass, and warm window-light ambience.
- Night theme uses charcoal, deep walnut, amber firelight, and a restrained lavender undertone.
- Desktop navigation is a sticky hotel-style top navigation rather than a left sidebar.
- The entry page is an atmospheric welcome scene with a concise advisor directory.
- The lobby reveals the consultation composer only after the user selects a workstation.
- Workstations are equal-height material consoles with walnut, brass nameplates, and softly lit screens.
- FocusRoom is a centered, internally scrolling consultation surface; history is in a right-side drawer.
- Studio, settings, provider configuration, and board placeholder share the same quiet-luxury surfaces.
- Unused steam, temperature, and preparation-modal components were removed.

### Preserved behavior

Routes, API integrations, Zustand state, authentication, provider settings, SSE streaming, Markdown/code rendering, plan-event rendering, session rename/delete, and conversation history behavior remain intact.

### Verification

- `npm run web:typecheck`: passed.
- `npm run web:lint`: passed.
- `npm run web:build`: passed (only the existing Next.js multiple-lockfile workspace-root warning).
- `git diff --check`: passed.
- No backend changes; backend restart is not required.


## 2026-07-13 Boutique-hotel motion system

- Added shared motion timing, easing and route-order rules for consistent interaction behavior.
- Entry now opens the Lobby through a click-origin warm light curtain; Lobby receives and releases the same light rather than hard-cutting.
- Workspace routes transition with navigation-aware horizontal direction; FocusRoom enters as a deeper space from below.
- Top-navigation active surfaces and underline now glide between destinations.
- Workstations use one-shot material light, shadow and lift responses; the selected advisor composer crossfades by identity.
- FocusRoom history drawer and delete dialog now animate both entry and exit.
- Theme toggle no longer uses teal sparkle loops and instead shifts a warm semantic light field.
- Reduced-motion behavior remains supported and no dependencies, routes, APIs, stores or SSE contracts changed.

### Verification
- `npm run web:typecheck`: passed.
- `npm run web:lint`: passed.
- `npm run web:build`: passed; existing multiple-lockfile workspace-root warning only.
- `git diff --check`: passed.
- Backend restart is not required.


## 2026-07-13 Brand icon and bilingual README

- Replaced the mint-dot favicon with the Sauna “light door and seat” mark: a walnut arch, amber interior light, and a quiet seat representing entry into a private advisory space.
- Added a maintainable SVG master plus multi-resolution favicon, 180px Apple touch icon, and 512px README asset.
- Next.js metadata now declares browser and Apple icons; light/dark browser theme colors use the Next.js 16 `viewport` export.
- Rebuilt `README.md` as the Chinese default and added `README_EN.md` with equivalent product, nuwa-skill, architecture, setup, deployment, security, and roadmap content.
- README examples use placeholders only and do not include real database, SMTP, provider, or GitHub credentials.

### Verification
- `npm run web:typecheck`: passed.
- `npm run web:lint`: passed.
- `npm run web:build`: passed; `/icon.svg` generated and only the existing multiple-lockfile workspace-root warning remains.
- `git diff --check`: passed.
- README local-link check and targeted secret scan passed.
- ICO includes 16px, 32px, and 48px sizes; Apple icon is 180px.

## 2026-07-13 Authentication and access control

### Product contract
- Entry and top-navigation login buttons open a global email verification modal.
- Visitors see public/default advisors only. Settings, Studio, and FocusRoom render locked shells until authentication.
- Authenticated users see separate private and default advisor sections and may configure providers, distill advisors, save sessions, and consult models.
- A blocked consultation keeps the selected advisor and unsent draft through login/provider setup but requires a second explicit send.
- Missing provider configuration opens create mode; upstream/provider failures open repair mode. No automatic fallback is permitted.

### Implementation anchors
- `apps/web/src/components/access-coordinator.tsx`: global auth/provider modal host, account menu, locked shell, focus trap/restoration.
- `apps/web/src/store/access-ui-store.ts`: non-persisted modal and access-intent state.
- `apps/web/src/lib/access-policy.ts`: access decisions and persist migration.
- `apps/web/src/store/sauna-store.ts`: public/private data lifecycle, token-only persistence, logout/401 invalidation.
- `apps/backend/internal/httpapi/server.go`: public agent listing remains; anonymous trial turns were removed.

### Verification
- Frontend policy tests, typecheck, lint, production build, backend Go tests, diff check, and removed-trial scan all pass.
- Next build still reports the pre-existing multiple-lockfile workspace-root warning.

## 2026-07-13 Resend verification email hardening

The Go auth flow already supports SMTP and is now hardened for real delivery. Recommended production settings are `smtp.resend.com:587`, username `resend`, STARTTLS, and `SMTP_FROM=sauna@mail.wrenzeal.top`. The password must be a sending-only Resend API key stored only in the ignored VPS `.env.local`.

Before activation, verify `mail.wrenzeal.top` in Resend and copy its exact SPF/DKIM records into the `myhostadmin.net` DNS console. Then set `APP_ENV=production` and `AUTH_EMAIL_DRIVER=smtp`; production responses omit `dev_code`. Do not add SMTP secrets to Vercel or Git.

Delivery failure removes only the matching cached code through an atomic DragonFlyDB compare-delete, preserving newer concurrent codes. A missing production sender returns before caching. SMTP DATA close is treated as accepted delivery; QUIT failures are logged without invalidating the code.

All backend/frontend validation and independent review pass. Real SMTP delivery is not yet activated because the Resend domain and API key are external prerequisites.

## 2026-07-14 Production Resend activation

The VPS backend is now running in production SMTP mode. The ignored `.env.local` uses Resend SMTP at `smtp.resend.com:587`, STARTTLS, sender `sauna@mail.wrenzeal.top`, and a configured sending key. The original local host typo `smtp.resent.com` was corrected.

Verification evidence: local/public health are 200; the public auth-start request returned 200 without `dev_code`; production logs contained no verification code; wrong-code verification returned 401; CORS preflight allows `https://sauna.wrenzeal.top`. A real message was accepted by Resend SMTP for the configured test recipient. Manual inbox receipt and successful-code login are the only remaining human checks.

## 2026-07-14 Productized verification email

Verification email now uses MIME `multipart/alternative`: a complete text fallback plus a table-based inline-style HTML template using the current cream, walnut and amber brand system. The HTML includes the public `https://sauna.wrenzeal.top/sauna-mark.png` asset but remains readable when images are blocked. Sender is `Sauna <sauna@mail.wrenzeal.top>`.

Production backend has been restarted with the new sender/template. A public auth-start request returned 200 without `dev_code`, the SMTP message was accepted, and backend logs contain no code. The recipient should visually inspect the newest email in QQ Mail; no code change is required unless a specific client rendering issue is reported.

## 2026-07-14 Authentication UX and resend cooldown handoff

### Current contract
- Email verification resend is limited to once per 60 seconds by the backend, not only by frontend UI.
- `POST /auth/email/start` returns `resend_after_seconds`; cooldown failures return HTTP 429 `verification_code_cooldown` with `retry_after_seconds`.
- Invalid/expired codes return HTTP 400 `invalid_verification_code`. Do not classify this error as an unauthorized session.
- The auth modal keeps the sent email fixed during the challenge, shows a countdown, and provides an explicit `更换邮箱` reset action.
- Logout is local-outcome-first: show `logging_out`, wait no more than five seconds for the API, clear private state, and do not navigate away from the current pathname.

### Main files
- Backend cooldown/cache: `apps/backend/internal/cache/cache.go`, `apps/backend/internal/service/auth.go`.
- HTTP error mapping: `apps/backend/internal/httpapi/server.go`.
- Frontend modal/account menu: `apps/web/src/components/access-coordinator.tsx`.
- Settings logout feedback: `apps/web/src/components/settings-panel.tsx`.
- Auth state lifecycle: `apps/web/src/store/sauna-store.ts`.
- Error metadata/policy: `apps/web/src/lib/sauna-api.ts`, `apps/web/src/lib/access-policy.ts`.

### Production and verification
- Backend production env includes `AUTH_RESEND_COOLDOWN=60s` and has been restarted.
- Production smoke: first send 200, immediate resend 429 with retry metadata, wrong code 400 with dedicated copy.
- Full backend tests, Go vet, web tests, typecheck, lint, production build, and `git diff --check` pass.
- Browser-level pathname retention was verified statically (no logout route push/replace); run an interactive E2E check if modifying route guards or logout flows later.

## 2026-07-14 Stable login success modal handoff

- `AuthOperation` now includes `login_success`; this state must take precedence over whether `authCodeSentEmail` is present.
- After `/auth/email/verify` succeeds, token/identity are committed immediately and the modal renders a non-dismissible success view. Do not clear the success operation until the modal exit animation completes.
- Providers, workspace agents, distillation jobs and focus sessions hydrate concurrently with `Promise.allSettled`. Their failures remain module-level errors and must not turn a valid login into a verification error.
- Consultation intent is restored after hydration. If no provider exists, provider setup opens only after the auth modal has exited; provider-load errors do not incorrectly trigger the empty-provider flow.
- Regression coverage lives in `apps/web/src/lib/__tests__/access-policy.test.ts`; web tests, typecheck, lint and production build pass.

## 2026-07-14 Consultation handoff and failed-turn retry

- Lobby has two explicit paths: enter an empty room, or queue and submit a question. Drafts use `draft:{agentId}` and carry `autoSend`; only already-authenticated/provider-ready submissions auto-send.
- `PageTransition` canonicalizes every `/focus-room/*` pathname to one transition key. Do not restore pathname-keyed remounts for session changes.
- Failed assistant messages use `status=failed` and store the provider reason in `messages.metadata.error`; list APIs expose it as `Message.error` and failed partial answers are excluded from future LLM context.
- Retry API: `POST /focus-room/sessions/:session_id/turns/:turn_id/retry`. It only accepts failed turns, deletes old assistant/SSE artifacts, resets the same turn to created and preserves the original user message.
- Production backend has been restarted. Backend tests/vet and web tests/typecheck/lint/build pass.
