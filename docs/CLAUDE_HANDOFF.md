# Claude Handoff

## Current product state

Sauna is a curated AI advisor workspace. The old online Tavily/Worker distillation flow is retired. Users no longer create private人物 Skills inside the web app.

The active flow is:

1. Browse `/catalog`.
2. Install a shared, audited advisor reference into the workspace.
3. Consult installed advisors with the user's configured LLM Provider.
4. Submit a missing-person request when the advisor is absent.
5. The single administrator distills locally with `nuwa-skill`, validates/imports the package, and publishes it.
6. Followers receive an in-app notification and email; everyone receives an announcement.

Anonymous visitors may browse and open `/try/[slug]`. The architecture supports three platform-funded turns per day and 24-hour history, but production still needs dedicated `GUEST_LLM_BASE_URL`, `GUEST_LLM_API_KEY`, and `GUEST_LLM_MODEL` values.

## Important routes

- `/lobby`: installed advisors for authenticated users; public trial advisors for visitors.
- `/catalog`: search, categories, install/remove, and request dialog.
- `/catalog/[slug]`: advisor provenance and actions.
- `/try/[slug]`: anonymous temporary consultation.
- `/admin/catalog-requests`: visible only to the allowlisted admin.
- `/studio`: redirects to `/catalog`.

## Backend operations

- API port: `19588`.
- Start/stop: `npm run dev:start`, `npm run dev:stop`.
- DragonFly: `127.0.0.1:16379`.
- PostgreSQL Docker container: `postgres-db`, database `sauna`.
- Admin allowlist: `SAUNA_ADMIN_EMAILS`.
- Catalog operator guide: `docs/CATALOG_ADMIN.md`.
- Validate/import packages from `apps/backend` with `go run ./cmd/catalog validate|import`.

## Database state

Applied migrations include:

- `004_real_nuwa_runtime.sql` retained for migration history compatibility.
- `005_curated_catalog.sql` creates catalog/request/notification/guest tables and permanently removes private advisors and their consultation history.
- `006_seed_default_catalog_subscriptions.sql` seeds featured advisors once per workspace.

Recovery backup created before destructive migration:

```text
.runtime/backups/sauna-before-curated-catalog-20260716-103909.sql
```

## Verification

- Go tests: 57 passed.
- `go vet ./...`: passed.
- Web tests: 15 passed.
- TypeScript: passed.
- ESLint: passed.
- Next.js production build: passed.
- Backend health and public catalog smoke: passed.
- Public guest endpoint correctly returns `503 guest_provider_unavailable` until the dedicated platform model is configured.

## Constraints

- Do not commit `.env*`, `.runtime/`, `.codex/`, or database backups.
- Do not reintroduce user-run online distillation, Tavily, or a Worker queue without a new product decision.
- Installed advisors are references, not Skill copies.
- New sessions use the latest public advisor version; historical sessions remain pinned.
- Backend admin middleware is authoritative; hiding the frontend nav is not access control.
