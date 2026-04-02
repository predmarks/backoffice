# Predmarks Market Agents

Agentic pipeline for sourcing, reviewing, and resolving prediction markets for Predmarks.

This project is built with Next.js + TypeScript and uses:
- Drizzle + Postgres for persistence
- Inngest for orchestration
- Claude (Anthropic SDK) for agent reasoning
- OpenAI embeddings for candidate deduplication

## What is implemented

- Market data model and lifecycle persistence (`candidate` -> `processing` -> `proposal` -> `approved` -> `open` -> `closed` -> `resolved` / `rejected`)
- Reviewer pipeline with iterative improvement:
  - data verification
  - hard/soft rule checks
  - scoring
  - rewrite/improver loop
- Sourcer pipeline:
  - RSS + data ingestion
  - market generation
  - optional embedding-based deduplication
  - auto-trigger review events
- Dashboard views for proposals, market detail/actions, and resolution queue
- API routes for market CRUD/actions, sourcing trigger/status, and Inngest handler

See `ARCHITRECTURE.md` for the detailed system design and prompts.

## Tech stack

- Next.js 16 (App Router)
- TypeScript (strict)
- Postgres (`postgres` + Drizzle ORM)
- Inngest
- Anthropic SDK
- OpenAI SDK (embeddings)

## Requirements

- Node.js 20+
- npm
- Postgres database URL
- Anthropic API key
- (Optional) OpenAI API key for deduplication

## Environment variables

Create `.env.local` with:

```bash
POSTGRES_URL=postgres://...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=... # optional, used for embedding dedup
```

## Setup

```bash
npm install
```

Push schema to your database:

```bash
npx drizzle-kit push
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Useful scripts

This repo currently uses direct `tsx` execution for test/seed scripts:

```bash
npx tsx scripts/seed.ts
npx tsx scripts/test-sourcing.ts
npx tsx scripts/test-review.ts
```

## API overview

See `ARCHITRECTURE.md` for the full 39-route API reference. Key endpoints:

- `GET /api/markets?status=...` - list markets
- `GET /api/markets/:id` - market detail
- `POST /api/markets/:id/reject` - reject market
- `POST /api/markets/:id/edit` - edit market fields
- `POST /api/markets/:id/resolve` - confirm resolution
- `POST /api/markets/:id/check-resolution` - trigger resolution check
- `POST /api/review/:id` - trigger review pipeline
- `GET/POST /api/topics` - list/create topics
- `GET /api/signals` - search signals
- `POST /api/generate` - trigger market generation
- `POST /api/sourcing` - trigger sourcing job
- `GET/POST/DELETE /api/chat` - MiniChat (44 tools)
- `POST /api/sync-deployed` - sync onchain markets
- `GET|POST|PUT /api/inngest` - Inngest webhook

## Notes

- All market content should be in Spanish.
- Code should stay in English.
- Rules should be loaded from `src/config/rules.ts` (not hardcoded in prompts).
