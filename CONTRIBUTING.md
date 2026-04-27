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

## Web app structure: `app/` vs `src/app/`

Suppr's Next.js 15 web app uses two parallel top-level directories. **This is intentional, not a half-finished refactor**:

- **`app/`** — Next.js App Router routes only. Page files (`page.tsx`), layouts, route handlers (`route.ts`), `error.tsx`, `not-found.tsx`. Anything Next's file-system router consumes lives here. Don't put non-route components here.
- **`src/app/components/`** — All React components (UI primitives in `src/app/components/ui/`, product components in `src/app/components/suppr/`, screen-level components like `MealPlanner.tsx`, `NutritionTracker.tsx`, `RecipeDetail.tsx`). Routes import from here via the `@/*` path alias mapped to `src/*` in `tsconfig.json`.
- **`src/lib/`** — Non-component logic shared by both web and mobile (mobile imports via relative `../../../src/lib/...`). Nutrition, planning, server helpers, types.
- **`src/types/`** — TypeScript shapes shared by web and mobile.
- **`src/context/`** — React contexts (web only — mobile has its own at `apps/mobile/context/`).

**Why split?** History: an early Next.js scaffold put routes at the project root, components under `src/`. Migrating now would touch every import path in the project for negligible benefit. Routes-vs-components is genuinely a different concern; the `@/*` alias makes the mental model "routes pull from `@/components/*`" without per-file relative-path noise.

**When you add a new file:**
- New page or API route → `app/...`
- New React component → `src/app/components/...`
- New shared logic → `src/lib/...`
- New shared type → `src/types/...`

**Never:**
- Put a non-route component under `app/` (would shadow Next's router conventions).
- Import directly from a route file into a component (route files are leaves; the data flow is route → context → component).
- Reach across to `apps/mobile/...` from the web tree (mobile is a downstream consumer of `src/lib/*` only).

ESLint will not catch most of these by itself; the convention is enforced at PR review. If a future maintainer wants to consolidate, that's tracked as **P2-21** in the [Opus 4.7 codebase review](docs/audits/2026-04-25-opus47-codebase-review.md) — explicit decision in [`docs/decisions/2026-04-25-app-src-app-split.md`](docs/decisions/2026-04-25-app-src-app-split.md).
