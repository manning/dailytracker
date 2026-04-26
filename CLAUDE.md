# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DailyTracker is a personal health/habit tracking app. See `PRD.md` for full product requirements and feature scope.

Technical stack: Node.js/TypeScript backend, PostgreSQL on Railway, React web app, React Native + Expo mobile app.

## Monorepo Structure

```
/backend    — Node.js + TypeScript REST API (Express + Prisma)
/web        — React + TypeScript web app (Recharts for graphs)
/mobile     — React Native + Expo app (iOS + Android)
```

Each workspace has its own `package.json`. Run commands from within the relevant directory unless a root-level script exists.

## Commands

### Backend (`/backend`)
```bash
npm run dev          # start dev server with hot reload
npm run build        # compile TypeScript
npm run start        # run compiled output
npm run db:generate  # generate migration from schema changes
npm run db:migrate   # apply migrations to the database
npm run db:push      # push schema directly (local dev, no migration files)
npm run db:studio    # open Drizzle Studio to inspect data
npm test             # run tests
npm run lint         # lint
```

### Web (`/web`)
```bash
npm run dev          # start Vite dev server
npm run build        # production build
npm test             # run tests
npm run lint         # lint
```

### Mobile (`/mobile`)
```bash
npx expo start       # start Expo dev server
npx expo run:ios     # run on iOS simulator
npx expo run:android # run on Android emulator
```

## Architecture

### API
The backend exposes a REST API consumed by both the web and mobile clients. All routes are prefixed `/api/v1`. Authentication uses JWT tokens.

### Data Model
The core design uses a flexible metric definition + entry pattern so users can create arbitrary metrics without schema changes:

- **users** — account credentials and preferences; email/password auth
- **metric_definitions** — user-defined metrics: `name`, `type` (number | scale | boolean | duration | categorical | text), `unit` (e.g. "lbs", "hours"), `color`, `order`, `allow_multiple_per_day` (bool), `connector_id` (nullable, for future external data sources), `archived_at` (nullable — soft delete, history is always preserved)
- **metric_entries** — timestamped log entries: references `metric_definition_id`, stores `numeric_value` and/or `text_value`, full timestamp (date + time-of-day), `source` (`manual` | `connector`), `connector_ref` (nullable external ID for dedup)

**Key data decisions:**
- Entries store full timestamps — users can log at any time and backdate to previous days
- Metrics are soft-deleted (archived) not hard-deleted — history is always preserved
- `connector_id` and `source` fields are present from the start so Apple Health / other integrations are not a retrofit
- New users get a starter set of common metrics: weight, sleep hours, mood (1–10), pain level (1–10), exercise

The Drizzle schema lives at `backend/src/db/schema.ts`. After any schema change run `db:generate` to generate a migration, and `db:migrate` to apply it. Use `db:push` for fast iteration during local development (skips migration files).

### Shared Types
TypeScript types shared between backend, web, and mobile live in `/shared` (or are exported from the backend and imported by clients). Do not duplicate type definitions across workspaces.

## Environment Variables

The backend expects:
```
DATABASE_URL     # PostgreSQL connection string (provided by Railway)
JWT_SECRET       # secret for signing JWTs
PORT             # defaults to 3000
```

Railway injects `DATABASE_URL` automatically. For local development, copy `.env.example` to `.env` in `/backend`.

## Hosting

- **Backend + PostgreSQL**: Railway — deploy by pushing to `main`; Railway runs `npm run build && npm run start`
- **Web**: TBD (Railway static site or Vercel)
- **Mobile**: Expo (development builds via EAS for distribution)

## LLM Integration

The backend will expose a `POST /api/v1/chat` endpoint for users to ask ad hoc questions about their data (e.g. "why might my pain be higher this week?"). The LLM has **read-only** access — it cannot log or modify entries.

**Architecture rules:**
- LLM provider is hidden behind an interface (`LLMProvider`) so the underlying model (Gemini, Claude Haiku, etc.) can be swapped via config without changing call sites
- The LLM API key is server-side only — never sent to web or mobile clients
- Context is built by fetching the user's metric definitions + last N days of entries; this same query is used for graphs, so no duplicate data-fetching logic
- The endpoint is stubbed but unimplemented until the core data model and logging features are complete

**Model choice is deferred** — do not implement a specific provider until explicitly decided.

## Key Libraries

| Layer | Library | Purpose |
|-------|---------|---------|
| Backend ORM | Drizzle | Schema, migrations, type-safe queries |
| Backend framework | Express | HTTP routing |
| Web charts | Recharts | Time-series and correlation graphs |
| Mobile/Web UI | React Native / React | Shared component patterns where possible |
| Mobile platform | Expo | iOS + Android builds from one codebase |
