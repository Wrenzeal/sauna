# Sauna

Sauna is a personal AI brain-trust workspace. It lets users consult with a set of distilled advisors, and later distill their own advisors from structured persona prompts and knowledge material inspired by the nuwa-skill approach.

## What it does

- **Lobby**: shows available advisors as a workspace-style brain trust.
- **Focus room**: one-to-one consultation with a selected advisor.
- **Distillation studio**: creates user-owned advisor skills from a public template or a new distillation job.
- **Model settings**: stores user-provided OpenAI-compatible provider configuration such as Base URL, API key, and model.
- **Streaming chat**: streams assistant output over SSE and persists real consultation history.

## Tech stack

- **Frontend**: Next.js 16 App Router, React 19, Tailwind CSS, Zustand, Motion.
- **Backend**: Go, Gin, Clean Architecture-style service/repository/http layers.
- **Database**: PostgreSQL with `pgvector` and `pgcrypto`.
- **Cache**: DragonFlyDB or Redis-compatible cache.
- **LLM adapter**: OpenAI-compatible chat completions and model listing endpoints.

## Repository layout

```text
apps/web       Next.js frontend
apps/backend   Go API server, migrations, nuwa-skill seed data
docs           Product context and notes
scripts        Local start/stop scripts
```

## Prerequisites

- Node.js and npm
- Go 1.25 or newer
- PostgreSQL with `pgvector` and `pgcrypto`
- DragonFlyDB or Redis-compatible service

A typical local setup uses:

```text
PostgreSQL: 127.0.0.1:5432, database sauna
DragonFlyDB: redis://127.0.0.1:16379/0
Backend:    http://127.0.0.1:19588
Frontend:   http://127.0.0.1:3000
```

## Environment variables

Copy the example file and edit values for your machine. The local start script reads `.env` and `.env.local`; both are ignored by git.

```bash
cp .env.example .env
```

Important backend variables:

```text
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/sauna?sslmode=disable
REDIS_URL=redis://127.0.0.1:16379/0
SAUNA_SECRET_KEY=change-me-to-a-long-random-secret
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://sauna.wrenzeal.top
```

Important frontend variables:

```text
NEXT_PUBLIC_SAUNA_API_BASE_URL=http://127.0.0.1:19588/api/v1
```

Do not commit real `.env` files or provider API keys.

## Install

```bash
npm install
npm --prefix apps/web install
```

Go dependencies are resolved by the backend module:

```bash
cd apps/backend
go mod download
```

## Run locally

From the repository root, after configuring `.env` or `.env.local`:

```bash
npm run dev:start
```

This starts only the Go backend on `:19588`. The frontend is expected to run on Vercel for the deployed app.

Stop the backend with:

```bash
npm run dev:stop
```

For local UI development, run the frontend separately:

```bash
npm run web:dev
```

The local frontend will proxy `/api/sauna/*` to the backend configured by `SAUNA_BACKEND_INTERNAL_URL`.

## Verification

```bash
npm run backend:test
npm run web:typecheck
npm run web:lint
npm run web:build
```

Backend health check:

```bash
curl http://127.0.0.1:19588/health
```

## Deployment notes

### Frontend on Vercel

Recommended Vercel settings:

```text
Root Directory: apps/web
Build Command: npm run build
Environment: NEXT_PUBLIC_SAUNA_API_BASE_URL=https://api.sauna.wrenzeal.top/api/v1
```

The production frontend domain is intended to be:

```text
https://sauna.wrenzeal.top
```

### Backend behind Nginx

The backend should run privately on the VPS, for example on `127.0.0.1:19588`, and be exposed through Nginx:

```text
https://api.sauna.wrenzeal.top
```

For SSE streaming, disable proxy buffering in the Nginx location that forwards to the Go API.

## Advisor and nuwa-skill model

Default advisors are seeded from markdown skill files under:

```text
apps/backend/seed/nuwa-skills
```

A user consultation loads the selected advisor's current skill content into the system prompt before calling the configured LLM provider. User-created advisors are stored as private agent versions and can later be extended with richer RAG ingestion through PostgreSQL and `pgvector`.

## Security notes

- Provider API keys are encrypted before storage and only masked hints are returned to the frontend.
- `.env`, local runtime state, local Codex/OMX state, build output, sqlite files, and dependency directories are ignored by git.
- Public deployments must set a strong `SAUNA_SECRET_KEY` and an explicit production `DATABASE_URL`.
