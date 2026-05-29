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
| `npm run test:coverage` | All of `src/**` (web + shared lib) | **Baseline gate** in CI (see below) |
| `npm run mobile:test:coverage` | `apps/mobile/app/**` + `lib/**` | Mobile workspace gate |

### Whole-app baseline (`npm run test:coverage`)

As of 2026-05-28 (plan-import lib tests, `normalizeImageForAi`, shared `weightTrend`, CSV import fix):

| Metric | `src/**` | `src/lib/**` only |
|--------|----------|-------------------|
| Lines / statements | ~57% | ~84% |
| Branches | ~82% | ~84% |
| Functions | ~76% | ~86% |

CI enforces minimum thresholds in `vitest.unit.config.ts` (lines/statements 56%, branches 80%, functions 74%). **Ratchet these up** as coverage improves — never lower without explicit decision.

**Why headline % looks low:** ~45k lines live in React components (`NutritionTracker`, `ProgressDashboard`, `AppDataContext`, …) with little or no render coverage. Shared business logic under `src/lib/**` is already strong; closing the gap means component/integration tests on critical surfaces, not more parser unit tests.

**Phased backlog (whole-app):**

1. **Shared lib parity** — port existing mobile unit tests for code under `src/lib/**` that web imports but doesn't exercise (e.g. `weightTrend.ts` ✅, plan-import parsers ✅ partial, `normalizeImageForAi` ✅ partial).
2. **API route integration** — extend `tests/integration/*` for routes still at 0% (auth-adjacent, imports, webhooks).
3. **Critical components** — RNTL/Playwright component tests for Today, food search, paywall, onboarding (highest user-impact, largest uncovered line count).
4. **Mobile** — `npm run mobile:test:coverage` separately; keep web/mobile parity tests aligned via `@suppr/shared` → `src/lib`.

HTML report: `coverage/index.html` after `npm run test:coverage`.

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
| `nutritionEntriesSourceWriteParity.test.ts` | 8 | `nutrition_entries.source` canonical write contract (ENG-674) |
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

## Coverage Gaps

| Area | Status | Risk |
|------|--------|------|
| AppDataContext (central state) | No tests | High — most complex logic |
| Recipe import pipeline | No happy-path test | Medium — requires API keys |
| Verification pipeline (end-to-end) | Golden + **mocked USDA + mocked OFF** integration tests; FatSecret branch still thin | Low–medium — add mocked FatSecret serving edge cases if FS stays in product |
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

**Web job:** `npm ci` → `verify:production-env` → `tsc` → `npm run test:coverage` → Playwright install → `npm run build` → `next start` on port 3100 → `npm run test:e2e`.

**Mobile job:** under `apps/mobile` — ESLint, TypeScript, import-path guards, `npm run test:coverage` (Vitest with Istanbul coverage for `app/**` and `lib/**`; HTML under `apps/mobile/coverage/`), `npm run test:e2e:verify-suite` (Maestro flow files + `config.yaml` manifest — does not run the simulator on CI).

## Related Documents

- [Testing system specification](./SYSTEM.md)
- [Test plan / inventory](./test-plan.md)
- [Screen ↔ Maestro matrix](../qa/SCREEN_TEST_MATRIX.md)
- [Technical Architecture](../technical/architecture.md)
