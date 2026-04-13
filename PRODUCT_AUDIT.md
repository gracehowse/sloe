# Product Audit — Platemate

**Date**: 2026-04-12
**Verdict**: **Promising** — strong foundation with real technical depth, but critical reliability gaps prevent production deployment.

---

## What This App Appears to Be

A recipe-centric nutrition platform: import recipes from Instagram/TikTok/websites, get automatic macro breakdowns, plan meals that hit calorie/protein targets, generate shopping lists, track daily nutrition. Cross-platform (Next.js web + React Native mobile). Targets health-conscious home cooks who want MyFitnessPal-level accuracy without the tedious manual entry.

**Who it's for**: People who find recipes on social media and want to know the macros before they cook. Weight-loss goal-setters who want a meal plan that actually fits their calorie budget.

---

## What Is Actually Built

### Real and Functional
- **Recipe import pipeline**: URL → HTML parsing → JSON-LD extraction → ingredient parsing → USDA/OFF/FatSecret nutrition lookup → per-ingredient macros. This is genuinely good engineering — multi-source fallback, UK name aliases, smart scoring, portion-aware gram weights.
- **TDEE-based onboarding**: Mifflin-St Jeor calculation with plan pace selection, nutrition strategy, goal date projection. 14-step guided flow on mobile.
- **Macro-aware meal planner**: Weighted scoring algorithm (protein priority 4.2, calorie band ±12%, recency penalty, variety rotation). Not AI — deterministic optimization. Honest and effective.
- **Food search**: Unified USDA + Open Food Facts search with verified badges, deduplication, title-casing, inline macros. MFP-style serving picker (g/oz/tbsp/tsp/cup/ml + USDA portions).
- **Ingredient verification**: User can review and fix auto-matched ingredients against USDA database.
- **Shopping list generation**: From meal plan, merges duplicate ingredients, categorises by food type.
- **Cook mode**: Step-by-step with auto-extracted timers, keep-awake.
- **Auth**: Email/password + sign-up + Apple Sign-In (wired, pending Apple Developer setup) + magic link.
- **Billing**: Stripe checkout for web (3-tier: Free/Base/Pro).
- **Deployed**: Web on Vercel, mobile builds to device.

### Partially Built / Fragile
- **Recipe creation on mobile**: Functional but no image upload, no instructions validation.
- **Nutrition tracker**: Basic quick-add + search-to-log. No meal slot validation, no weekly stats, no streaks.
- **Barcode scanner**: Camera permission + scanning works, but product lookup is stubbed.
- **Subscription paywall on mobile**: UI built, no real IAP (placeholder for RevenueCat).
- **Discover feed pagination**: Hard-capped at 50 recipes, no infinite scroll.
- **Social features**: savedCount is hardcoded on some cards, hearts are localStorage-only on web.

### Mocked / Missing
- **Zero offline support**: No caching, no retry queue, no "you're offline" state. App is unusable without internet.
- **No test coverage for mobile**: 10 unit tests + 2 integration tests + 2 e2e tests — all for web. Mobile has zero tests.
- **No error monitoring**: No Sentry, no crash reporting, no analytics beyond basic event tracking.
- **No image upload for user recipes** (mobile or web).
- **No food diary export** (PDF, CSV).
- **No social/community features**: No comments, no ratings, no follower system.
- **No push notifications**: Permission prompt exists but no FCM/APNs integration.

---

## What Is Good

1. **Nutrition accuracy pipeline** — The multi-source USDA → OFF → FatSecret → estimation chain with UK name aliases, smart confidence scoring, food-specific portions, and dish-word penalties is genuinely competitive with commercial products. Better than many apps that only use one source.

2. **Recipe import from social media** — Instagram/TikTok → OpenAI caption extraction → recipe parsing is a real differentiator. Most competitors require manual entry.

3. **Ingredient parsing robustness** — Handles "1 heaped tbsp", "2 x 400g tins", "½ small avocado", UK ingredients (courgette, aubergine, coriander). This is hard to do well and it works.

4. **Macro-aware meal planning** — The scoring algorithm is mathematically sound. Protein-first weighting, calorie bands, variety constraints. Better than random or simple assignment.

5. **Cross-platform code sharing** — The nutrition pipeline, TDEE calculator, and ingredient parser are in `src/lib/` shared between web and mobile. Good architectural decision.

6. **Unit switching** — kg/lb/st for weight, cm/ft+in for height, g/oz/tbsp/tsp/cup/ml for portions. Worldwide accessibility.

---

## What Is Weak / Risky

### Critical (would cause user-visible data loss)

1. **No transaction safety on saves**: `saveImportedRecipe` and `saveVerifiedIngredients` can leave recipes in inconsistent states if any step fails (recipe saved, ingredients partially saved, totals not updated). Real users will see wrong calorie counts.

2. **No offline handling**: App shows blank screens or generic "Network error" when connectivity drops. Users on mobile data (the primary use case) will hit this constantly.

3. **Auth token expiry not handled**: Session tokens expire; no refresh logic. Users will get mysterious 401 errors after ~12 hours.

4. **1 failing test**: `calculateTargets.test.ts` is broken by the goal type refactor (`"cut"` → `"lose"`). This should have been caught before deployment.

### Serious (degrades trust)

5. **Silent error swallowing**: Multiple `catch {}` blocks that return empty arrays. User sees "no results" when the real issue is a network timeout or API error. Impossible to debug in production.

6. **Hardcoded social metrics**: `savedCount: 1247` on seed recipes. Fake engagement numbers erode user trust if noticed.

7. **No monitoring/crash reporting**: When things break in production, no one will know until users complain.

8. **No input validation on API responses**: Multiple `as any` casts. If Supabase schema changes, app silently serves wrong data.

### UX Gaps

9. **Discover feed is only 50 recipes**: No pagination, no filtering by dietary preference, no search. Compare to MyFitnessPal's millions of entries.

10. **No recipe images from user creation**: Users can create recipes on mobile but can't add photos. The resulting cards look broken in the feed.

---

## Competitor Comparison

| Feature | Platemate | MyFitnessPal | Lose It! | MacroFactor | Yummly |
|---------|-----------|--------------|----------|-------------|--------|
| Recipe import from URL | Yes (strong) | No | No | No | Yes (basic) |
| Social media import | Yes (Instagram, TikTok) | No | No | No | No |
| USDA nutrition data | Yes + OFF + FatSecret | Yes | Yes | Yes | Partial |
| Barcode scanning | Stubbed | Yes (best) | Yes | Yes | No |
| Macro-aware meal planning | Yes (algorithmic) | Premium only | Premium only | Yes | No |
| Onboarding with TDEE | Yes (14-step) | Yes | Yes (best) | Yes (best) | No |
| Food diary/tracker | Basic | Best-in-class | Strong | Best-in-class | No |
| Offline support | None | Full | Full | Full | Partial |
| Community/social | None | Strong | Moderate | None | Strong |
| Recipe creation | Basic | No | No | No | Yes |
| Shopping list | From plan | No | No | No | Yes |
| Verified food database | USDA badges | Full DB | Full DB | Full DB | N/A |
| Price | Free / £29.99/yr | Free / £69.99/yr | Free / £75.99/yr | £71.99/yr | Free |

**Where Platemate wins**: Recipe import from social media links. No competitor does this well. The nutrition pipeline with UK aliases and multi-source verification is also above average.

**Where Platemate loses**: Food diary depth (MFP/MacroFactor are leagues ahead), barcode scanning (Platemate's is stubbed), offline support (everyone else has it), community size (zero vs millions), food database size (69 recipes vs millions).

---

## What Prevents This Being Best-in-Class

1. **Reliability**: You can't ship a nutrition app where calorie counts might be wrong due to partial save failures. Trust is everything in this category.

2. **Content scarcity**: 69 recipes and 2 users. The discover feed will feel empty to any new user. Need 500+ curated recipes minimum, or a robust import-on-first-use flow.

3. **No offline mode**: Nutrition tracking is a habit app. If it doesn't work on the tube, in the gym, or in a supermarket with bad signal, users won't form the habit.

4. **Barcode scanning is the #1 feature request in every food app**: It's stubbed. This is table stakes.

5. **No food diary depth**: MFP's food diary has meal slots, recent foods, favourites, custom foods, recipe integration, barcode history. Platemate's tracker is a quick-add box.

---

## Top 10 Improvements (Priority Order)

1. **Fix data integrity**: Wrap saves in Supabase transactions or implement compensation logic. Recipe + ingredients + totals must be atomic.

2. **Add offline caching**: Cache recipes, meal plans, and recent foods in AsyncStorage/SQLite. Show cached data when offline. Queue mutations for retry.

3. **Implement barcode scanning properly**: Wire the camera scanner to Open Food Facts product lookup (the API call already exists in `lookupBarcode`).

4. **Add error monitoring**: Integrate Sentry on both web and mobile. Every silent `catch {}` should report to Sentry.

5. **Seed 500+ recipes**: Run the seed script against a curated list of recipe URLs. The import pipeline is strong — use it at scale.

6. **Build proper food diary**: Meal slots (breakfast/lunch/dinner/snack), recent foods list, favourites, recipe-to-diary flow, weekly macro summary.

7. **Add pagination to discover**: Infinite scroll or "load more" for the recipe feed. 50-recipe cap is not viable.

8. **Handle auth token refresh**: Detect 401s, refresh session, retry. Standard Supabase pattern.

9. **Fix the failing test**: Update `calculateTargets.test.ts` to use `"lose"` instead of `"cut"`. Run tests in CI.

10. **Add CI pipeline**: GitHub Actions: lint, typecheck, test on every PR. The goal type breakage would have been caught.

---

## Final Verdict: **Promising** (7/10 concept, 4/10 production-readiness)

The product idea is strong — recipe import from social media with automatic macro verification fills a real gap. The nutrition pipeline engineering is genuinely impressive (better than most competitors). The onboarding flow is Lose It!-quality. The meal planning algorithm is mathematically sound.

But the gap between "features exist" and "features work reliably" is where this product currently sits. Data integrity issues, zero offline support, no error monitoring, and content scarcity mean a real user would hit frustrating failures within their first week. The app looks polished but is structurally fragile.

**Ship-blocking issues**: Transaction safety on saves, auth token refresh, offline caching, barcode scanning completion. Fix these four and it's a viable v1.

**Not ship-blocking but competitive necessity**: 500+ recipes, proper food diary, CI pipeline, push notifications.

The technical foundation is solid. The nutrition accuracy work is a genuine moat. The cross-platform architecture is clean. This is 2-3 weeks of reliability engineering away from a compelling v1 launch.
