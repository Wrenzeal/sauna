<div align="center">
  <img src="apps/web/public/sauna-mark.svg" width="112" alt="Sauna mark: a doorway of light and a quiet seat" />
  <h1>Sauna</h1>
  <p><strong>Think through difficult questions with your personal AI brain trust.</strong></p>
  <p>
    <a href="README.md">简体中文</a> ·
    <a href="README_EN.md">English</a>
  </p>
</div>

Sauna is a personal AI brain-trust workspace. It ships with advisors already distilled through a `nuwa-skill`-style process and lets users create private advisor Skills of their own. During a consultation, Sauna loads the selected Skill and calls the user's configured LLM with real-time streaming output.

> The project is under active development. The product UI is still evolving, so the repository intentionally avoids screenshots that may quickly become outdated.

## Core experience

- **Advisor lobby**: browse default and private advisors as workstations, then select one before asking a question.
- **VIP focus room**: SSE streaming, Markdown, code blocks, execution-plan rendering, and consultation history.
- **Distillation studio**: create a Skill from a public template or submit a new `nuwa-skill` distillation job.
- **Model settings**: store an OpenAI-compatible Base URL, API key, provider, and model.
- **Real authentication**: email verification codes, delivered through SMTP in production.
- **Board sauna**: planned multi-advisor collaboration and debate.

## How nuwa-skill fits

Default advisors are not created by a one-line “imitate this person” prompt. The backend stores distilled Skill Markdown as versioned content. For every consultation, it assembles the selected advisor's identity, reasoning framework, and current Skill into the system prompt before calling the user's model.

Default Skills live in:

```text
apps/backend/seed/nuwa-skills
```

The repository currently includes seed Skills for Steve Jobs, Elon Musk, Richard Feynman, Charlie Munger, Naval Ravikant, and Paul Graham. User-created advisors are stored as private Agents with versioned Skills; supporting knowledge can later be retrieved through PostgreSQL and `pgvector`.

## Architecture

```text
Browser / Next.js 16
        │  REST + SSE
        ▼
Go API / Gin
        │
        ├── Auth, Workspace, Agent, Session, Turn
        ├── Prompt Assembly / nuwa-skill Loader
        └── OpenAI-compatible LLM Adapter
        │
        ├── PostgreSQL + pgvector + pgcrypto
        └── DragonFlyDB / Redis-compatible cache
```

- **Frontend**: Next.js 16 App Router, React 19, Tailwind CSS, Zustand, and Motion.
- **Backend**: Go and Gin with Domain / Repository / Usecase / Handler boundaries.
- **Database**: PostgreSQL for relational and vector data.
- **Cache**: DragonFlyDB for verification codes, rate limits, and runtime state.
- **LLM layer**: OpenAI-compatible model discovery and streaming Chat Completions.

## Repository layout

```text
apps/web       Next.js frontend
apps/backend   Go API, migrations, and nuwa-skill seeds
scripts        Local runtime scripts
docs           Product context and cross-environment handoff notes
```

## Requirements

- Node.js and npm
- Go 1.25+
- PostgreSQL with `pgvector` and `pgcrypto`
- DragonFlyDB or another Redis-compatible service

Typical local services:

```text
PostgreSQL: 127.0.0.1:5432 / sauna
DragonFly:  redis://127.0.0.1:16379/0
Backend:    http://127.0.0.1:19588
Frontend:   http://127.0.0.1:3000
```

## Configuration

```bash
cp .env.example .env
```

Core backend variables:

```dotenv
APP_ENV=development
HTTP_ADDR=:19588
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@127.0.0.1:5432/sauna?sslmode=disable
REDIS_URL=redis://127.0.0.1:16379/0
SAUNA_SECRET_KEY=change-me-to-a-long-random-secret
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
AUTH_EMAIL_DRIVER=dev
```

Frontend variables:

```dotenv
NEXT_PUBLIC_SAUNA_API_BASE_URL=http://127.0.0.1:19588/api/v1
SAUNA_BACKEND_INTERNAL_URL=http://127.0.0.1:19588
```

Production email login also requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_SECURITY`. Never commit real database credentials, SMTP passwords, or model keys.

## Install and run

```bash
npm install
npm --prefix apps/web install
cd apps/backend && go mod download && cd ../..
```

Start the Go backend on the VPS:

```bash
npm run dev:start
```

Stop it with:

```bash
npm run dev:stop
```

Run the frontend for local UI development:

```bash
npm run web:dev
```

Health check:

```bash
curl http://127.0.0.1:19588/health
```

## Verification

```bash
npm run backend:test
npm run web:typecheck
npm run web:lint
npm run web:build
git diff --check
```

## Deployment

### Vercel frontend

```text
Root Directory: apps/web
Build Command: npm run build
NEXT_PUBLIC_SAUNA_API_BASE_URL=https://api.sauna.wrenzeal.top/api/v1
```

The production frontend is `https://sauna.wrenzeal.top`. Vercel only needs the public API URL; database, SMTP, platform-model, and encryption secrets belong on the backend.

### Go backend and Nginx

The Go service listens on `127.0.0.1:19588` and is exposed by Nginx at `https://api.sauna.wrenzeal.top`. SSE proxy locations must disable buffering and use a sufficiently long read timeout. The backend environment owns database, DragonFlyDB, `SAUNA_SECRET_KEY`, CORS, and SMTP configuration.

## Security boundaries

- Provider API keys are encrypted at rest; the frontend only receives masked hints.
- Login codes and authentication endpoints are rate-limited through DragonFlyDB; signed-out users can only browse the default advisors.
- `.env` files, build output, dependency directories, local runtime state, and Codex/OMX state must not be committed.
- Production requires a strong `SAUNA_SECRET_KEY`, an explicit `DATABASE_URL`, and SMTP configuration.

## Roadmap

- Complete the external Agent executor and distillation job queue.
- Chunk and embed uploaded materials into `pgvector`.
- Build multi-advisor board discussions with synthesis and disagreement views.
- Add stable product screenshots, contribution guidance, and automated end-to-end tests.
