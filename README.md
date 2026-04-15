# Suppr

Web app for macro-first meal planning, recipe discovery, nutrition logging, and shopping lists. Built with Next.js (App Router), React, Supabase, and Stripe.

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
| `npm test` | Unit / integration tests (Vitest) |
| `npm run test:e2e` | Playwright E2E |
| `npm run smoke:production` | HTTP smoke against `PLAYWRIGHT_BASE_URL` |

## Documentation

- [Environment variables](docs/environment.md)
- [Supabase RLS checklist](docs/supabase-rls-checklist.md)
- [Observability (analytics & errors)](docs/observability.md)
- [Health / Apple Health platform decision (Phase B)](docs/health-platform-phase-b.md)
- [Best-in-class execution plan](docs/best-in-class-plan.md)
- [Product roadmap](docs/product-roadmap.md)

## License

Private / all rights reserved unless otherwise stated by the project owners.
