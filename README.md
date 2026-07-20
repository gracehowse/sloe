# Suppr

Web app for macro-first meal planning, recipe discovery, nutrition logging, and shopping lists. Built with Next.js (App Router), React, Supabase, and Stripe.

> **Source-available, not open source.** Public for transparency and free CI during pre-launch. All rights reserved. See [LICENSE](./LICENSE).

## Prerequisites

- Node.js 20+ (recommended)
- npm

## Setup

```bash
npm install
```

Copy environment variables from your team vault or Vercel. See [`docs/environment.md`](docs/environment.md) for the full variable matrix.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run production server locally |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (web `src/`, `app/`, `tests/`) |
| `npm test` | Unit / integration tests (Vitest) |
| `npm run test:e2e` | Playwright E2E |
| `npm run smoke:production` | HTTP smoke against `PLAYWRIGHT_BASE_URL` |
| `npm run db:types` | Regenerate Supabase types for web, then copy the canonical output to mobile |
| `npm run db:types:check` | Fail if web and mobile Supabase type files have drifted; run `npm run db:types` to fix |
| `npm run ci` | Full local gate mirroring CI: env verify, migrations, typecheck, lint, tests, every `check:*` ratchet below, web build, and the mobile checks — run once before every push |
| `npm run check:type-scale` | Ratchet: off-ladder web `text-[Npx]` classes (ENG-119) |
| `npm run check:type-scale-mobile` | Ratchet: raw mobile `fontSize: N` literals off the `Type` ramp (ENG-1002) |
| `npm run check:spacing-scale` | Ratchet: off-scale mobile spacing literals (ENG-1007) |
| `npm run check:web-spacing-scale` | Ratchet: off-scale web Tailwind `p-*/m-*/gap-*` spacing (ENG-1592, the web leg of ENG-1007) |
| `npm run check:token-scale` | Ratchet: raw hexes / off-scale Tailwind colours / border-radius, web + mobile (ENG-1007) |
| `npm run check:screen-budget` | Ratchet: no screen file over the pinned 400-line budget (ENG-717) |
| `npm run mobile:lint` | ESLint for `apps/mobile` |
| `npm run mobile:typecheck` | TypeScript check for `apps/mobile` |
| `npm run mobile:test` | Unit tests for `apps/mobile` (Vitest) |

## Documentation

- [Environment variables](docs/environment.md)
- [Supabase RLS checklist](docs/supabase-rls-checklist.md)
- [Observability (analytics & errors)](docs/observability.md)
- [Health / Apple Health platform decision (Phase B)](docs/health-platform-phase-b.md)
- [Best-in-class execution plan](docs/best-in-class-plan.md)
- [Product roadmap](docs/product-roadmap.md)

## License

Private / all rights reserved unless otherwise stated by the project owners.
