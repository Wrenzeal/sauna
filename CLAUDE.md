# Claude Code instructions for Sauna

You are collaborating on the Sauna repository from a different server than the Codex session. Treat Git-tracked files as the shared project memory. Do not assume access to the other agent's local `.codex/`, `.omx/`, `.runtime/`, `TODO_LIST.md`, `PROJECT_STATE.md`, or `CHANGE_LOG.md` files unless they are present on your machine.

## Required first read

Before making changes, read these files in order:

1. `CLAUDE.md`
2. `DESIGN.md`
3. `docs/CLAUDE_HANDOFF.md`
4. `docs/PRD_CONTEXT.md`
5. `README.md`
6. `AGENTS.md` if it exists locally

Then summarize the current project state, recent changes, validation commands, and risks before editing.

## Product context

Sauna is a personal AI brain-trust workspace. It provides default advisors distilled as nuwa-skill style skill prompts and allows users to create their own advisors later. The user experience is a Chinese UI with concepts such as:

- `智囊大厅` for the lobby
- `蒸馏车间` for the distillation studio
- `VIP 桑拿房` for one-to-one consultation
- `董事会桑拿` for the future multi-advisor room

Use English identifiers in code and Chinese labels in visible UI where the product specifies Chinese names.

## Architecture constraints

- Frontend: Next.js 16 App Router, React 19, Tailwind CSS v4, Zustand, Motion, Phosphor icons.
- Backend: Go with Gin, Clean Architecture-style domain, repository, usecase/service, handler boundaries.
- Database: PostgreSQL with `pgvector` and `pgcrypto`.
- Cache: DragonFlyDB or Redis-compatible service.
- LLM: OpenAI-compatible provider config, model listing, and streaming chat completions.
- Keep LLM API calls, prompt assembly, and HTTP handlers decoupled.
- Do not add external vector databases.

## Current runtime assumptions

- Backend app path: `apps/backend`.
- Frontend app path: `apps/web`.
- Backend local port: `19588`.
- Production frontend domain: `https://sauna.wrenzeal.top`.
- Production API domain: `https://api.sauna.wrenzeal.top/api/v1`.
- Frontend is expected to deploy on Vercel; the VPS runs the Go backend behind Nginx.

## Workflow rules

- Keep diffs focused and reversible.
- Prefer existing patterns and semantic theme variables over new abstractions.
- Do not commit or print secrets, API keys, SMTP passwords, real database credentials, tokens, local logs, or `.env` files.
- If local ignored memory files exist, maintain them according to the local workflow. If they do not exist, update `docs/CLAUDE_HANDOFF.md` for cross-server shared state instead.
- For cross-server collaboration, append meaningful state changes to `docs/CLAUDE_HANDOFF.md` after verified work.
- If you make a commit, follow the repository Lore commit message style when possible.

## Verification commands

Frontend changes:

```bash
npm run web:typecheck
npm run web:lint
npm run web:build
```

Backend changes:

```bash
npm run backend:test
```

Full standard check:

```bash
npm run backend:test
npm run web:typecheck
npm run web:lint
npm run web:build
```

Use `git diff --check` before finalizing changes.

## UI design direction

`DESIGN.md` is the authoritative UI/UX contract. The current frontend uses a quiet-luxury private-club visual system:

- Day mode: cream, ivory, walnut and soft daylight warmth.
- Night mode: charcoal, deep walnut, amber firelight and a restrained lavender undertone.
- Navigation is a hotel-like top bar; do not restore the persistent desktop sidebar.
- Workstations use material consoles with walnut, brass and softly lit screens.
- Do not restore distillation tanks, temperature gauges, steam particles, full-room scenes, Three.js or continuous decorative animation.
- Theme colors live in `apps/web/src/app/globals.css` as semantic `--sauna-*` CSS variables.
- Use the existing `ThemeToggle` and preserve its localStorage and View Transition behavior.
