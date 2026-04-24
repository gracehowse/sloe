save # Contributing to Suppr

## Worklists (avoid duplicate tracking)

| List | Use for |
|------|---------|
| [`TODO.md`](TODO.md) | Grace / product ship checklist, legal gates, TestFlight IDs, dated deadlines. |
| [`docs/planning/consolidated-audit-todos-2026-04-24.md`](docs/planning/consolidated-audit-todos-2026-04-24.md) | Audit-derived engineering rows (mostly **done** — historical). |
| [`docs/product/PARITY_PRODUCT_QUEUE.md`](docs/product/PARITY_PRODUCT_QUEUE.md) | Optional product follow-up after engineering parity **prep** (sign-off, tickets). |
| [`docs/planning/sweep-2026-04-executor-backlog.md`](docs/planning/sweep-2026-04-executor-backlog.md) | Agent-driven executor queue (separate from `TODO.md`). |

## Database migrations and types

After adding or changing SQL under `supabase/migrations/`:

1. Apply with `supabase db push --linked` (or your team’s canonical path).  
2. Regenerate TypeScript types: `npm run db:types`  
   This overwrites `src/lib/supabase/database.types.ts` and copies to `apps/mobile/lib/database.types.ts`.

Run `npm run check:migrations` locally (needs Supabase CLI **linked** project) to compare file names/versions with `schema_migrations`. CI does **not** run this by default (requires link + auth).

## Lint and tests (repo root)

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint for `src/`, `app/`, `tests/` (Next **core-web-vitals** + relaxed ratchet — warnings allowed up to the script cap). |
| `npm run typecheck` | TypeScript for the Next app and shared `src/`. |
| `npm test` | Vitest (`tests/**`). |
| `npm run mobile:lint` / `mobile:typecheck` / `mobile:test` | Expo app under `apps/mobile/`. |

Full gate: `npm run ci` (see `package.json`).

## Playwright (web E2E)

See [`tests/e2e/README.md`](tests/e2e/README.md). GitHub Actions needs repository secrets for authenticated journeys; forks typically run **public smoke only**.

## Maestro (mobile)

CI runs `npm run mobile:test:e2e:verify-suite` (manifest / shared flows only). A **full** device or simulator run is manual or release-gated — see [`apps/mobile/.maestro/README.md`](../apps/mobile/.maestro/README.md).

## Regional nutrition (UK / AU)

Planning note (not shipped): [`docs/planning/region-food-data-uk-au.md`](docs/planning/region-food-data-uk-au.md). Track product decision in `TODO.md` when picking up Phase A.

## `PARITY_AUDIT.md`

[`PARITY_AUDIT.md`](PARITY_AUDIT.md) is a **dated narrative snapshot** of web vs mobile features. **Normative** parity rules and process live in [`docs/product/web-mobile-parity-scope.md`](docs/product/web-mobile-parity-scope.md).
