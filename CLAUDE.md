# Predmarks Agents

## What this is
Agentic system for sourcing, reviewing, and resolving prediction markets
for Predmarks, an Argentina-focused prediction market platform.

## Architecture
Read ARCHITECTURE.md for the full system design, data models, prompts,
rules, and implementation roadmap.

## Tech stack
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Vercel Postgres + Drizzle ORM
- Inngest for job orchestration
- Claude API (Sonnet) for all LLM agents
- Deployed on Vercel

## Conventions
- All market content in Spanish (Argentine)
- All code in English
- Use Drizzle for all database access
- Never hardcode rules into prompts — load from config/rules.ts

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npx drizzle-kit push` — Push schema changes
