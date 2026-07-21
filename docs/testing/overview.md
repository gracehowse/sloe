# Testing Documentation

**Audience:** Developers / QA

**Testing system spec (priorities, human case format, tiers, honesty bar):** [SYSTEM.md](./SYSTEM.md)

## Test Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit + integration tests |
| Playwright | E2E browser tests |
| Midscene | AI-assisted natural language E2E (dependency present; **not** the primary merge gate — optional / nightly; see [SYSTEM.md](./SYSTEM.md)) |

## Test Coverage

Two separate coverage tracks — do not mix them:

| Command | Scope | Target |
|---------|--------|--------|
| `npm run test:storybook:coverage` | 10 UI primitives with stories (`vitest.storybook.config.ts`) | **100%** on scoped files |
| `npm run test:coverage` | All of `src/**` **and root `app/**`** (web + shared lib + Next.js routes) | **Baseline gate** in CI (see below) |
| `npm run mobile:test:coverage` | `apps/mobile/app/**` + `lib/**` | **Baseline gate** — mobile workspace (see below) |

### Whole-app baseline (`npm run test:coverage`)

**ENG-1351 (2026-07-05):** root `app/**` (123 files — routes, billing/checkout pages, the DMCA
form, error boundaries) was previously neither included nor excluded from the coverage `include`
glob, so it was silently unmeasured and could never fail the gate below. It is now folded into
`include` alongside `src/**`. Honest combined actuals after folding it in:

| Metric | Combined (`src/**` + `app/**`) |
|--------|----------------------------------|
| Lines / statements | 59.52% |
| Branches | 79.4% |
| Functions | 76.34% |

CI enforces minimum thresholds in `vitest.unit.config.ts` — **lines/statements 59%, branches 79%,
functions 76%** (lowered from the old `src/**`-only 56/56/80/74 on 2026-07-05 to reflect the newly
measured `app/**` volume — see the ENG-1351 comment in that file for the full rationale). **Ratchet
these up** as coverage improves — never lower without explicit decision.

**Why headline % looks low:** ~45k lines live in React components (`NutritionTracker`, `ProgressDashboard`, `AppDataContext`, …) with little or no render coverage, and root `app/**` route/page files are mostly thin wrappers with no render tests yet. Shared business logic under `src/lib/**` is already strong; closing the gap means component/integration tests on critical surfaces, not more parser unit tests.

**Phased backlog (whole-app):**

1. **Shared lib parity** — port existing mobile unit tests for code under `src/lib/**` that web imports but doesn't exercise (e.g. `weightTrend.ts` ✅, plan-import parsers ✅ partial, `normalizeImageForAi` ✅ partial).
2. **API route integration** — extend `tests/integration/*` for routes still at 0% (auth-adjacent, imports, webhooks).
3. **Critical components** — RNTL/Playwright component tests for Today, food search, paywall, onboarding (highest user-impact, largest uncovered line count).
   - ENG-1140 adds `tests/unit/loadBearingCtaBehaviour.test.tsx` as the render-level home for load-bearing CTA behaviour (end-fast, LogSheet manual log commit, and onboarding terminal commit). Source-grep button/card tests are anti-drift token/variant pins only; rendered click/disabled/loading behaviour must be covered in RTL tests.
4. **Root `app/**` routes** — now measured (ENG-1351); largely untested Next.js route/page files (billing, DMCA, error boundaries) are the next largest uncovered block after React components.
5. **Mobile** — `npm run mobile:test:coverage` separately; keep web/mobile parity tests aligned via `@suppr/shared` → `src/lib`.

HTML report: `coverage/index.html` after `npm run test:coverage`.

### Mobile baseline (`npm run mobile:test:coverage`)

**ENG-1351 (2026-07-05):** `apps/mobile/vitest.config.ts` previously had no `coverage.thresholds`
block, so mobile coverage could regress freely with nothing to fail against. It now enforces a
floor at the honest actuals measured the same day (istanbul provider, `app/**` + `lib/**` —
mostly large untested RN screens under `app/**`, e.g. `TodayScreen.tsx`, `planner.tsx`):

| Metric | Actual | Enforced floor |
|--------|--------|-----------------|
| Lines | 17.27% | 17% |
| Statements | 16.7% | 16% |
| Branches | 11.3% | 11% |
| Functions | 14.74% | 14% |

**Ratchet these up** as `apps/mobile/app/**` screens get test coverage — never lower without
explicit decision.

### Unit Tests (510+ files; run `npm test` for current counts)

| File | Tests | Covers |
|------|-------|--------|
| `calculateTargets.test.ts` | 10 | TDEE → macro target calculation |
| `classifyMealType.test.ts` | 22 | Meal type auto-classification |
| `confidenceGating.test.ts` | 16 | Confidence thresholds for USDA/OFF/FatSecret match acceptance |
| `pepperDisambiguation.test.ts` | 15 | Pepper spice vs vegetable disambiguation across parsing, weight, macros |
| `measureToGramsCategories.test.ts` | 15 | Sauce/condiment defaults, grain defaults, cup densities, unknown unit fallback |
| `fatsecretServing.test.ts` | 11 | FatSecret serving mass parsing, description fallback, metric preference |
| `mealPlanSmartFeatures.test.ts` | 8 | Slot weighting, portion scaling, configurable slots, seeded randomness, variety |
| `estimateIngredientMacros.test.ts` | 22 | Local macro estimation fallback |
| `exportNutritionCsv.test.ts` | 6 | CSV export formatting |
| `homeProfileGate.test.ts` | 4 | `/` profile gate: `onboarding_completed` fast path vs legacy field completeness |
| `dietaryPreferences.test.ts` | 3 | Canonical dietary ids + `normaliseDietaryFromProfile` |
| `generateMealPlan.test.ts` | 29 | Meal plan algorithm output validity |
| `imperial.test.ts` | 10 | kg↔lb, cm↔in conversion |
| `measureToGrams.test.ts` | 38 | Count-to-weight normalisation |
| `mealPlanAlgo.test.ts` | 9 | Mobile meal plan algorithm |
| `mealPlanFingerprint.test.ts` | 6 | Plan fingerprint for shopping list sync |
| `parseIngredientLine.test.ts` | 42 | Ingredient text parsing (fractions, units, ranges) |
| `parseRecipeFromHtml.test.ts` | 17 | Recipe HTML/JSON-LD extraction |
| `persistence.test.ts` | 4 | localStorage snapshot read/write |
| `portionMultiplier.test.ts` | 10 | Portion scaling and day totals |
| `tdeeEdgeCases.test.ts` | 9 | TDEE clamp floors, macro reconciliation, budget safety |
| `rateLimitStrictFail.test.ts` | 5 | Rate limiter fails closed in prod without Upstash (ENG-668) |
| `rateLimitKeyComposition.test.ts` | 4 | Per-user rate-limit bucket key contract |
| `nutritionEntriesSourceWriteParity.test.ts` | 10 | `nutrition_entries.source` canonical write contract (ENG-674) |
| `onboardingSessionGateParity.test.ts` | 4 | Signup session gate shell wiring web ↔ mobile (ENG-672) |
| `shoppingDisplayGroups.test.ts` | 5 | Shopping item category grouping |
| `shoppingListGeneration.test.ts` | 10 | Shopping list generation from plan |
| `smartSuggestions.test.ts` | 2 | Recipe suggestion scoring |
| `stripeTier.test.ts` | 3 | Stripe price ID → tier mapping |
| `tdee.test.ts` | 24 | TDEE calculation, budgets, macro strategies |
| `trackerStats.test.ts` | 15 | Daily macro aggregation, streaks, fiber/water hits |
| `usdaNormalize.test.ts` | 5 | USDA nutrient extraction and kJ→kcal conversion |
| `deficitProjection.test.ts` | 4 | Calorie deficit rolling stats + today balance |
| `resolvedTier.test.ts` | 8 | RevenueCat entitlement → tier resolution + Supabase sync |
| `jsonLdEscape.test.ts` | 3 | JSON-LD XSS prevention (angle bracket escaping) |

### Integration Tests (5 files)

| File | Tests | Covers |
|------|-------|--------|
| `stripe-webhook-process.test.ts` | 3 | Webhook event dispatch + tier update |
| `verify-recipe-route.test.ts` | 3 | Verify API: invalid input + **200 golden path** (estimation-only mocks) |
| `verify-ingredients-golden.test.ts` | 6 | `verifyIngredients` golden cases: staples, count→weight, range sprigs, unverified empty name, `parseRawIngredients` lines |
| `verify-ingredients-usda-mock.test.ts` | 3 | Mocked FDC search/get: USDA accept + **low-confidence skip** + **fdcId override** |
| `verify-ingredients-off-mock.test.ts` | 2 | Mocked OFF search: high-confidence product vs **reject → Estimated** |

**Fixtures:** `tests/fixtures/verifyRecipeGolden.ts` — shared cases + `assertVerifyResultShape` / `expectPerServingMatchesTotals` helpers (external APIs mocked off → **Estimated** path).

### E2E Tests (4 files)

| File | Covers |
|------|--------|
| `auth-and-public.spec.ts` | Login page, public pages, unauthenticated redirect |
| `authenticated-views.spec.ts` | Authenticated app shell views |
| `suppr-natural-language.spec.ts` | AI-driven natural language tests |
| `views-placeholder.spec.ts` | Placeholder AI view tests |

### Synthetic-user persona testing (exploratory, additive)

Goal-driven exploratory testing by agents that act as different *kinds* of user
and log structured feedback — the layer that discovers the *unscripted* friction
Maestro/Playwright can't (a first-timer who can't find the log button; a sparse
logger who distrusts the maintenance number). **Additive**, never a replacement
for scripted E2E.

| Asset | Purpose |
|------|--------|
| `docs/testing/personas/README.md` | Roster + how a session runs |
| `docs/testing/personas/<name>.md` | The five persona definitions (input to a session agent) |
| `docs/testing/personas/RUNNER.md` | Self-contained session prompt + auth reality + feedback schema + closing protocol |
| `scripts/seed-persona.mts` | Seeds a believable history onto an allowlisted TEST account (`npm run seed:persona`) |
| `scripts/_lib/personaSeed.ts` | Pure, unit-tested core (allowlist guard + row shaping) |
| `tests/unit/personaSeed.test.ts` | Guards the safety allowlist + deterministic shaping |

## Coverage Gaps

| Area | Status | Risk |
|------|--------|------|
| AppDataContext (central state) | No tests | High — most complex logic |
| Recipe import pipeline | No happy-path test | Medium — requires API keys |
| Verification pipeline (multi-source cascade) | Golden + mocked-provider integration tests across **USDA, OFF, FatSecret, Edamam**. USDA **multi-candidate fallback** (top-2 parallel + serial tail, ENG-560) is covered by `verifyIngredientsUsdaMultiCandidate.test.ts` (ENG-1427); FatSecret/Edamam **ranked-candidate + fall-through-on-failure** by `verifyIngredientsRankedCandidates.test.ts` (ENG-1426) + the same ENG-1427 file's Edamam case | Low |
| RecipeDetail component | No tests | Medium |
| Mobile UI (full screens) | **Vitest + RNTL** for many components/helpers under `apps/mobile/tests/unit/`; **Maestro** for device flows in `apps/mobile/.maestro/` (see [qa/SCREEN_TEST_MATRIX.md](../qa/SCREEN_TEST_MATRIX.md)); not every screen has automation | Medium |
| Offline cache | No tests | Low |
| Auth flow | Web: Playwright E2E; mobile: Maestro + manual matrix | Low–medium |

### Manual / critical path (examples)

- **Dietary parity:** When I set dietary tags on web onboarding and open mobile onboarding for the same account, I expect the same tags to appear pre-selected after hydration.
- **Fiber target:** When I finish mobile onboarding, I expect `profiles.target_fiber_g` (not legacy `target_fiber` only) to be populated for web `AppDataContext` reads.

## Running Tests

```bash
# Unit + integration (web + shared)
npm test

# Same tests + V8 coverage report for `src/**` (summary in terminal; HTML → coverage/index.html)
npm run test:coverage

# Mobile workspace (from repo root): lint, typecheck, Vitest + coverage, Maestro manifest
npm run mobile:test:coverage

# Inside apps/mobile only:
# npm run test:coverage   # Istanbul coverage for app/** and lib/** → apps/mobile/coverage/

# E2E (local: Playwright starts dev server; CI uses build + start — see tests/e2e/README.md)
npm run test:e2e

# Type checking (web)
npm run typecheck

# Mobile belt (lint, tsc, vitest + coverage, Maestro manifest — no simulator required)
npm run mobile:verify
```

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`):

**Web job:** `npm ci` → `verify:production-env` → `tsc` → `npm run test:coverage` → `check:today-captures` → `check:type-scale` → `check:spacing-scale` → `check:web-spacing-scale` → `check:token-scale` → `check:type-scale-mobile` → `check:copy-voice` → `check:screen-budget` → Playwright install → `npm run build` → `next start` on port 3100 → `npm run test:e2e`.

**Static line/scale ratchets (web job):**

- `check:type-scale` (ENG-119) — Tailwind `text-[Npx]` off the canonical type ramp.
- `check:spacing-scale` (ENG-1007) — off-scale numeric spacing-prop literals
  (`padding` / `margin` / `gap` / `inset` / …) in mobile `apps/mobile/app` +
  `apps/mobile/components` `.tsx`. The legal scale is read at runtime from
  `apps/mobile/constants/theme.ts` (`Spacing` — 4/8/12/16/20/24/32/40, plus the
  `0` reset), never hardcoded. Per-file off-scale counts are pinned in
  `scripts/spacing-budget.json`; a pinned file may only shrink, and any
  un-pinned file that introduces an off-scale literal fails. Re-pin with
  `npm run check:spacing-scale:write`.
- `check:web-spacing-scale` (ENG-1592) — the web leg ENG-1007's own code
  comment promised and never built until 2026-07-21. Off-scale Tailwind
  `p-*/m-*/gap-*` spacing (any directional variant) in web `src/app` +
  `app` `.tsx`: arbitrary `p-[Npx]` bracket values AND off-scale numeric
  Tailwind steps, mapped step→px via Tailwind's `step * 0.25rem`
  convention (`p-6` = 24px is legal, `p-7` = 28px is not) — checked
  against the same 4/8/12/16/20/24/32/40 scale `check:spacing-scale` reads.
  `*-pm-N` semantic token classes (`px-pm-6`) are never flagged, the same
  way a `Spacing.*` reference is clean on mobile. Per-file off-scale
  counts are pinned in `scripts/web-spacing-budget.json` (261 files /
  1033 instances at the 2026-07-21 baseline); only-shrink. Re-pin with
  `npm run check:web-spacing-scale:write`.
- `check:token-scale` (ENG-1007) — raw 6-digit `#RRGGBB` hexes + raw Tailwind
  palette colour classes (`bg-/text-/border-<hue>-<NNN>`) + off-scale
  `borderRadius` literals (legal `Radius` read from theme.ts: 4/6/8/12/full)
  across web `src/app/components` + `app` and mobile `apps/mobile/app` +
  `apps/mobile/components`. Excludes token-def files (`theme.ts`, `theme.css`,
  the Tailwind theme); 3-digit hexes (`#000`/`#fff`) are not matched (Apple
  Sign-In brand carve-out). Per-file counts pinned in
  `scripts/token-budget.json`; only-shrink ratchet. Re-pin with
  `npm run check:token-scale:write`.
- `check:copy-voice` (ENG-1378) — extends the no-"!"/no-praise/no-vendor
  discipline already test-enforced on `weeklyRecapPushBody.ts` /
  `weeklyDigestSuggestion.ts` / `importErrorCopy.ts` to every user-facing
  string literal across web `src/app/components` + `app` and mobile
  `apps/mobile/app` + `apps/mobile/components`. Flags: a bare "!" in a UI
  string (Tailwind `className` important-modifier shapes and PostgREST
  embed-hint shapes like `profiles!author_id` are excluded — see the script's
  header comment for the exact precision tradeoffs); a vendor/env name
  (Supabase/Expo/EXPO_PUBLIC_\*/Postgres/Upstash/RevenueCat/Stripe) inside a
  prose string (an import-path-shaped string with no space never matches);
  and literal `"..."` where the canonical ellipsis glyph `…` is expected.
  Per-file counts pinned in `scripts/copy-voice-budget.json`; only-shrink
  ratchet. Re-pin with `npm run check:copy-voice:write`.
- `check:screen-budget` (ENG-717) — the "no screen file over 400 lines" rule;
  scans web `src/app/components` + `app` and mobile `apps/mobile/app` +
  `apps/mobile/components` `.tsx` surfaces, pins current offenders in
  `scripts/screen-line-budget.json` at their line count so they can only
  shrink, fails on any new >400 file or a pinned file growing. Re-pin a shrunk
  file with `npm run check:screen-budget:write`.

The spacing + token + copy-voice budgets each store an `allow` map alongside
`pins`: a full-file carve-out keyed by path with a required rationale string
(ENG-ref or explicit "intentional …" reason). A rationale-less (silent)
carve-out is itself a CI failure. `copy-voice-budget.json`'s allow map has six
entries (an OSS licences/attributions page, two billing/refund factual
disclosures, a `/dev/*` mock-data harness naming a competitor app whose real
name has a "!", and the already-`__DEV__`-gated `SupabaseNotConfiguredScreen`
from ENG-1456) — all rationale'd, none silent.

**Mobile job:** under `apps/mobile` — ESLint, TypeScript, import-path guards, `npm run test:coverage` (Vitest with Istanbul coverage for `app/**` and `lib/**`; HTML under `apps/mobile/coverage/`), `npm run test:e2e:verify-suite` (Maestro flow files + `config.yaml` manifest — does not run the simulator on CI).

## Related Documents

- [Testing system specification](./SYSTEM.md)
- [Test plan / inventory](./test-plan.md)
- [Screen ↔ Maestro matrix](../qa/SCREEN_TEST_MATRIX.md)
- [Technical Architecture](../technical/architecture.md)
