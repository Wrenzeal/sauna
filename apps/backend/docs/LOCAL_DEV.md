# Sauna backend local development

## Required services

- PostgreSQL with `pgcrypto` and `pgvector` available.
- DragonFlyDB or Redis-compatible cache.

The current local Docker mapping used by this workspace is:

- PostgreSQL: `127.0.0.1:5432`, database `sauna`.
- DragonFlyDB: `redis://127.0.0.1:16379/0`.

## Start backend

From the repository root, use the backend-only runtime script:

```bash
npm run dev:start
```

For a direct foreground backend run, use:

```bash
npm run backend:run
```

The development defaults are already wired in code for a generic local database:

```text
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/sauna?sslmode=disable
REDIS_URL=redis://127.0.0.1:16379/0
HTTP_ADDR=:8080
```

Override any of them when your local ports or credentials are different. `scripts/start-dev.sh` automatically loads ignored `.env` and `.env.local` files before starting the backend:

```bash
DATABASE_URL='postgres://postgres:<local-password>@127.0.0.1:5432/sauna?sslmode=disable' npm run backend:run
```

Production still requires an explicit `DATABASE_URL` because the development default is disabled when `APP_ENV=production`.

## Health check

```bash
curl http://127.0.0.1:8080/health
```

## Public agents

Migration `002_seed_public_agents.sql` seeds the default public templates:

- 乔布斯
- 马斯克
- 比尔盖茨
- 周受资

Logged-in users use their own default provider config for these public agents. Anonymous trial calls are rate-limited in DragonFlyDB and use only platform trial settings.
