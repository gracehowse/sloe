# Testing Documentation

**Audience:** Developers / QA

## Test Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit + integration tests |
| Playwright | E2E browser tests |
| Midscene | AI-assisted natural language E2E tests |

## Test Coverage

### Unit Tests (26 files, 359 tests)

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
| `generateMealPlan.test.ts` | 29 | Meal plan algorithm output validity |
| `imperial.test.ts` | 10 | kg↔lb, cm↔in conversion |
| `measureToGrams.test.ts` | 38 | Count-to-weight normalisation |
| `mealPlanAlgo.test.ts` | 9 | Mobile meal plan algorithm |
| `mealPlanFingerprint.test.ts` | 6 | Plan fingerprint for shopping list sync |
| `parseIngredientLine.test.ts` | 42 | Ingredient text parsing (fractions, units, ranges) |
| `parseRecipeFromHtml.test.ts` | 17 | Recipe HTML/JSON-LD extraction |
| `persistence.test.ts` | 4 | localStorage snapshot read/write |
| `portionMultiplier.test.ts` | 10 | Portion scaling and day totals |
| `rateLimitFallback.test.ts` | 9 | In-memory rate limiter |
| `shoppingDisplayGroups.test.ts` | 5 | Shopping item category grouping |
| `shoppingListGeneration.test.ts` | 10 | Shopping list generation from plan |
| `smartSuggestions.test.ts` | 2 | Recipe suggestion scoring |
| `stripeTier.test.ts` | 3 | Stripe price ID → tier mapping |
| `tdee.test.ts` | 11 | TDEE calculation |
| `trackerStats.test.ts` | 15 | Daily macro aggregation, streaks, fiber/water hits |
| `usdaNormalize.test.ts` | 5 | USDA nutrient extraction and kJ→kcal conversion |

### Integration Tests (2 files)

| File | Tests | Covers |
|------|-------|--------|
| `stripe-webhook-process.test.ts` | 3 | Webhook event dispatch + tier update |
| `verify-recipe-route.test.ts` | 2 | Verify API error cases (missing body, invalid input) |

### E2E Tests (4 files)

| File | Covers |
|------|--------|
| `auth-and-public.spec.ts` | Login page, public pages, unauthenticated redirect |
| `authenticated-views.spec.ts` | Authenticated app shell views |
| `platemate-natural-language.spec.ts` | AI-driven natural language tests |
| `views-placeholder.spec.ts` | Placeholder AI view tests |

## Coverage Gaps

| Area | Status | Risk |
|------|--------|------|
| AppDataContext (central state) | No tests | High — most complex logic |
| Recipe import pipeline | No happy-path test | Medium — requires API keys |
| Verification pipeline (end-to-end) | Unit tests for confidence gating only | Medium — full pipeline requires API mocks |
| RecipeDetail component | No tests | Medium |
| Mobile screens | No tests | Medium |
| Offline cache | No tests | Low |
| Auth flow | E2E only | Low |

## Running Tests

```bash
# Unit + integration
npm test

# E2E (requires built app + env vars)
npm run test:e2e

# Type checking
npm run typecheck
```

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`):
1. `npm ci`
2. `verify:production-env` — env validation
3. `tsc --noEmit` — typecheck
4. `npm test` — Vitest
5. Install Playwright (Chromium)
6. `npm run build` — Next.js build
7. Start `next start` on port 3100
8. Run Playwright E2E tests

## Related Documents
- [Technical Architecture](../technical/architecture.md)
