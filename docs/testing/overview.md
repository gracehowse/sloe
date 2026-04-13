# Testing Documentation

**Audience:** Developers / QA

## Test Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit + integration tests |
| Playwright | E2E browser tests |
| Midscene | AI-assisted natural language E2E tests |

## Test Coverage

### Unit Tests (10 files, 38 tests)

| File | Tests | Covers |
|------|-------|--------|
| `calculateTargets.test.ts` | 1 | TDEE → macro target calculation |
| `generateMealPlan.test.ts` | 1 | Meal plan algorithm output validity |
| `imperial.test.ts` | 3 | kg↔lb, cm↔in conversion |
| `parseIngredientLine.test.ts` | 8 | Ingredient text parsing (fractions, units, ranges) |
| `persistence.test.ts` | 4 | localStorage snapshot read/write |
| `portionMultiplier.test.ts` | 3 | Portion scaling and day totals |
| `shoppingDisplayGroups.test.ts` | 5 | Shopping item category grouping |
| `smartSuggestions.test.ts` | 2 | Recipe suggestion scoring |
| `stripeTier.test.ts` | 3 | Stripe price ID → tier mapping |
| `trackerStats.test.ts` | 3 | Daily macro aggregation |

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
