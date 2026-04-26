# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DailyTracker is a personal health/habit tracking app. Users define their own metrics (weight, pain level, sleep, etc.) and log values daily. It has a React Native mobile app, a React web app with graphing, and a shared Node.js/TypeScript backend API backed by PostgreSQL.

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
npm run db:migrate   # run Prisma migrations (npx prisma migrate dev)
npm run db:studio    # open Prisma Studio to inspect data
npm run db:generate  # regenerate Prisma client after schema changes
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

- **users** — account credentials and preferences
- **metric_definitions** — user-defined metrics: `name`, `type` (number | scale | boolean | duration | categorical | text), `unit` (e.g. "lbs", "hours"), `color`, `order`
- **metric_entries** — timestamped log entries: references `metric_definition_id`, stores `numeric_value` and/or `text_value`, timestamped to the day by default

The Prisma schema lives at `backend/prisma/schema.prisma`. After any schema change run `db:generate` to update the client, and `db:migrate` to apply to the database.

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

## Key Libraries

| Layer | Library | Purpose |
|-------|---------|---------|
| Backend ORM | Prisma | Schema, migrations, type-safe queries |
| Backend framework | Express | HTTP routing |
| Web charts | Recharts | Time-series and correlation graphs |
| Mobile/Web UI | React Native / React | Shared component patterns where possible |
| Mobile platform | Expo | iOS + Android builds from one codebase |
