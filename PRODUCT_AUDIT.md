# Product Audit — Suppr

> **Status:** Historical audit snapshot (2026-04-19) — reflects the product as of that date, not current state. Kept as a historical record; do not action its findings as live. **Linear is the canonical task tracker** for anything still outstanding.

**Date**: 2026-04-19
**Previous audit**: 2026-04-12 (see section "What changed in the last 7 days")
**Verdict**: **Shippable core, content-starved shell** — reliability gaps from the prior audit are substantially closed. The new ship-blockers are distribution (empty Discover feed) and monetisation (mobile IAP offerings not provisioned, server-side Pro gate leak on photo-log).

---

## What this app is

A recipe-centric nutrition platform: import recipes from Instagram/TikTok/websites, get automatic macro breakdowns, plan meals that hit calorie/protein targets, auto-generate a shopping list, track daily nutrition with meal slots and streaks. Cross-platform (Next.js web + Expo/React Native mobile, shared logic in [src/lib/](src/lib/)). Supabase backend with RLS.

**Who it's for**: people who find recipes on social media and want verified macros without manual entry; weight-loss goal-setters who want a plan that fits their calorie budget without rebuilding it every week.

---

## What is actually built

### Real and functional
- **Recipe import pipeline** — URL / Instagram / TikTok / YouTube / image → JSON-LD + caption LLM + transcription → ingredient parse → Suppr user_foods → USDA → Edamam → Open Food Facts → FatSecret → estimation. SSRF-blocked fetch. Confidence gating in [verifyIngredients.ts](src/lib/nutrition/verifyIngredients.ts) (`MIN_MATCH_CONFIDENCE = 0.42`, Atwater sanity check ratio 0.62–1.38). Golden fixtures pin the output.
- **Meal planner** — deterministic scoring in [mealPlanAlgo.ts](src/lib/nutrition/mealPlanAlgo.ts): protein-weighted, calorie-band (overshoot penalty 3×, undershoot 1.5×), joint portion scaler (F-15) clamped 0.2–2.5 at 0.1 steps, variety rotation, residual-protein gap fill. Shared by web and mobile, pinned by parity test.
- **Nutrition tracker** — now proper MFP-style: named meal slots ([mealSlots.ts](src/lib/nutrition/mealSlots.ts)), recent foods, favourites, saved meals, copy-meal + duplicate-day, progressive disclosure. This was "basic quick-add" in the prior audit — materially upgraded.
- **Streaks, freezes, weekly recap** — [streakFreeze.ts](src/lib/nutrition/streakFreeze.ts), [weeklyRecap.ts](src/lib/nutrition/weeklyRecap.ts), weekly recap push delivered server-side via [app/api/push/weekly-recap/route.ts](app/api/push/weekly-recap/route.ts).
- **Food search** — unified USDA + OFF + Edamam + FatSecret with dedup, verified badges, MFP-style serving picker (g/oz/tbsp/tsp/cup/ml + USDA portions). Pagination + natural-serving parity tests.
- **Ingredient verification UI** — web and mobile, override support, user-added ingredients.
- **Shopping list** — auto-generated from plan, lifecycle rules shared ([shoppingListLifecycle.ts](src/lib/planning/shoppingListLifecycle.ts)), unit-tested.
- **Cook mode** — step-by-step with auto-extracted timers, keep-awake. Web countdown + completion event; mobile count-up stopwatch (intentional divergence, documented + pinned by test).
- **Barcode scanning** — wired end-to-end in [verifyRecipe.ts:806](apps/mobile/lib/verifyRecipe.ts#L806) — user_foods first, OFF fallback, caffeine/alcohol per-100g, verification status. Walked back from "stubbed".
- **Apple Health sync + Adaptive TDEE** — [healthSync.ts](apps/mobile/lib/healthSync.ts), correlation + [adaptiveTdee.ts](src/lib/nutrition/adaptiveTdee.ts). Mobile-only by design.
- **Auth** — email/password, magic link, Apple Sign-In. `onAuthStateChange` now subscribed in [AuthSessionContext.tsx:25](src/context/AuthSessionContext.tsx#L25) — token refresh is handled; prior-audit "12-hour silent 401" is resolved.
- **Billing (web)** — Stripe checkout + webhook + tier write, integration-tested.
- **Mobile IAP wiring** — RevenueCat client + `syncTierToSupabase` live; paywall shows fallback if offerings empty.
- **Server-side tier enforcement (new)** — save cap RLS ([20260426100000_saves_free_tier_cap.sql](supabase/migrations/20260426100000_saves_free_tier_cap.sql)) and publish gate RLS ([20260426100100_recipes_publish_tier_gate.sql](supabase/migrations/20260426100100_recipes_publish_tier_gate.sql)). Client translates RLS error 42501 into paywall copy.
- **Voice log (Pro)** — server tier check at [voice-log/route.ts:42](app/api/nutrition/voice-log/route.ts#L42); 403 for Free; 100/day rate limit.
- **Offline caching (mobile)** — [offlineCache.ts](apps/mobile/lib/offlineCache.ts) caches discover / saved / plan / journal in AsyncStorage with 24h TTL. Walked back from "none" (mobile only — web has no offline).
- **Push notifications** — Expo push token, weekly recap delivery (Sat/Sun evening).
- **Error monitoring** — Sentry live on web (client/server/edge) and mobile. Walked back from "none".
- **CI pipeline** — [.github/workflows/ci.yml](.github/workflows/ci.yml): typecheck, unit, Playwright, build, E2E, mobile lint/typecheck/unit + cross-boundary import resolver. Walked back from "none".
- **Landing SSOT + parity tests** — [src/lib/landing/content.ts](src/lib/landing/content.ts) is the single source for pricing / roadmap / FAQ / nutrition sources / save cap. [tests/unit/landingParity.test.tsx](tests/unit/landingParity.test.tsx) enforces `FORBIDDEN_CLAIMS` and `BUILDING_ANCHORS`. Honest-claims regression-proofed.
- **Analytics** — 81 canonical event names in [events.ts](src/lib/analytics/events.ts) with rename-cycle handling. PostHog page-view tracker wired.
- **Household planning + fasting** — both present and shipping, not yet polished.

### Partially built / fragile
- **Onboarding** — *web 4 steps* ([app/onboarding/page.tsx:270](app/onboarding/page.tsx#L270)) vs *mobile 11 steps* ([apps/mobile/app/onboarding.tsx:71](apps/mobile/app/onboarding.tsx#L71)). Shared TDEE/budget/macro math; divergent UX. Violates the "no accidental divergence" rule.
- **Mobile paywall** — RevenueCat wired but offerings not provisioned in the dashboard ([docs/decisions/2026-04-revenuecat-offerings-empty.md](docs/decisions/2026-04-revenuecat-offerings-empty.md)); paywall falls back to "Subscriptions unavailable." Build 10 ships with "Trial unavailable in this build." Mobile cannot currently monetise.
- **Photo-log (Pro)** — client-gated; server allows Free requests through. Documented monetisation leak in [docs/product/landing-maintenance.md:59](docs/product/landing-maintenance.md#L59). Voice-log is closed; photo-log is the remaining hole.
- **`saveVerifiedIngredients`** — writes totals first then loops per-ingredient with composite error return ([verifyRecipe.ts:1005](apps/mobile/lib/verifyRecipe.ts#L1005)). If one ingredient fails, totals are already saved `is_verified: true` against an inconsistent ingredient set. Reduced blast radius vs the prior audit; still not ACID.
- **Household feature** — Build 10 fixed a `multiple-rows` error; surface is still maturing.
- **Recipe creation on mobile** — no user image upload; cards without an image look broken in the feed.
- **Web** — no offline mode; no publish-recipe UI on mobile yet (web only). Both documented.

### Mocked / missing
- **Discover content** — prior demo data wiped by [20260421180000_remove_all_seeded_recipes.sql](supabase/migrations/20260421180000_remove_all_seeded_recipes.sql). Committed re-seed script [scripts/seed-recipe-urls.txt](scripts/seed-recipe-urls.txt) lists **10 URLs** (Downshiftology). Combined with the new Base-tier publish gate, a fresh Free user lands on a near-empty Discover.
- **Food diary export** (PDF, CSV) — not implemented.
- **Community features** — no comments, ratings, or follow graph.
- **GrowthBook / LaunchDarkly** — no runtime flag system. Rename-cycles are self-policed via dated comments in [events.ts](src/lib/analytics/events.ts).

---

## What is good

1. **Nutrition verification depth** — multi-source cascade (user_foods → USDA → Edamam → OFF → FatSecret → estimation), confidence gating, Atwater plausibility check, golden fixtures. This is genuinely above the category average.
2. **Social recipe import as a differentiator** — Instagram/TikTok/YouTube caption + transcription → recipe parse. No incumbent does this well.
3. **Deterministic meal planner** — joint-scaler + protein-weighted scoring is honest and reproducible, not LLM hand-wave.
4. **Shared logic layer** — [src/lib/**](src/lib/) is actually load-bearing for both platforms (nutrition, TDEE, meal algo, shopping lifecycle, analytics names, landing content). Pinned by parity tests.
5. **Reliability has caught up** — Sentry, CI, offline cache (mobile), RLS-level tier enforcement, auth refresh subscription, atomic-on-failure recipe delete. The prior audit's "structurally fragile" label is no longer fair.
6. **Honest marketing** — `FORBIDDEN_CLAIMS` test guards against re-introducing claims the product doesn't back up ("400+ sources", "iOS + Android + web", "voice control", etc.).

---

## What is weak / risky

### Ship-blocking
1. **Empty Discover feed.** Near-zero recipes on first run. New users land with nothing to browse, and publishing is Base-gated so organic fill is slow. Reseeding at scale (500+) is the single most valuable change to growth right now.
2. **Mobile cannot monetise.** RevenueCat offerings not provisioned → paywall falls back to "Subscriptions unavailable." Any user who tries to upgrade on mobile sees a dead-end.
3. **Photo-log Pro bypass (server).** Free users can hit the API directly and consume the feature. Revenue leak + undermines the paywall narrative.
4. **Onboarding divergence.** 4 vs 11 steps is two different products from a user's perspective. Non-negotiable rule violation.

### Serious
5. **`saveVerifiedIngredients` not atomic.** Partial-update risk on ingredient verification; totals can land verified against inconsistent rows.
6. **Discover seeds + publish gate together.** A defensible monetisation move (publishing is premium) colliding with a supply problem (nothing to discover). Likely needs a curated "Suppr Picks" pool owned by the platform account.
7. **Household regressions still landing.** Build 10 fixed a multi-row error — feature not yet stable.
8. **Silent `catch {}` patterns still present** (e.g. [verifyRecipe.ts:843](apps/mobile/lib/verifyRecipe.ts#L843)) — reduced from prior audit but not eradicated.

### UX / polish
9. **No user-recipe images on mobile** — feed visual quality suffers.
10. **Web has no offline mode** — acceptable given mobile is the primary capture surface, but worth calling out.
11. **No food diary export** — requested category feature.

---

## Competitor comparison

| Dimension | **Suppr** | MyFitnessPal | Lose It! | MacroFactor | Yummly | Paprika | SideChef |
|---|---|---|---|---|---|---|---|
| URL recipe import | Yes | No | No | No | Limited | Yes | Yes |
| Social import (IG/TikTok) | **Yes** | No | No | No | No | No | Partial [?] |
| USDA / branded DB | USDA + OFF + FatSecret | Yes (UGC-heavy) | Yes | Yes (curated) | No | No | No |
| Barcode scanning | Yes (OFF) | Yes | Yes | Yes | No | No | No |
| Macro-aware meal planning | Yes (deterministic) | Manual | Manual | Algorithmic coaching | Basic | No | Weekly (manual) |
| TDEE onboarding | Yes | Yes | Yes | Yes (most rigorous) | No | No | No |
| Food diary depth | MFP-style slots + streaks | Deep | Deep | Deep (trend-weighted) | None | None | None |
| Offline support | Mobile only | Partial | Partial | Partial | Cache | **Full** | Cache |
| Community / social | None | Newsfeed, groups | Groups, challenges | None (deliberate) | Ratings | None | Comments, feeds |
| User recipe creation | Basic (no image) | Yes + image | Yes + image | Yes | Yes | Yes | Yes + video |
| Shopping list from plan | Yes | Premium | Premium | No | Yes | Manual | Yes |
| Verified food badges | **Yes** | Yes | Partial | Yes (curated) | N/A | N/A | N/A |
| Price (GBP, approx) | Free + paid | Free / ~£79.99 yr | Free / ~£31.99 yr | No free / ~£71.99 yr | Free (ads) | ~£4.99 once/platform | Free / ~£47.99 yr [?] |

Prices are approximate GBP conversions; verify before external quoting.

**Where Suppr wins.** Social-media recipe import is genuinely rare — trackers don't do it; recipe tools stop at URL. Combined with deterministic macro-aware planning and an auto shopping list, Suppr bridges "I saw a recipe" → "I have a plan and a basket" end-to-end, which no single competitor matches.

**Where Suppr loses.** Food-diary depth is better than a week ago but still thinner than MFP / MacroFactor. Community is non-existent; MFP's feed and SideChef's creator layer drive retention we're absent from. Paprika's full-offline recipe box remains a known moat we don't match.

---

## What prevents best-in-class

1. **Content scarcity.** Zero seeded recipes is a harder problem than any feature gap. First-run must not feel empty.
2. **Monetisation plumbing (mobile).** IAP offerings must exist for the paywall to work. This is a dashboard config job, not code.
3. **Parity between web and mobile onboarding.** One product, one flow.
4. **Server-side tier enforcement everywhere.** Save cap + publish gate did it right; photo-log needs to follow voice-log.
5. **Community layer.** Saves counter exists; comments, ratings, creator follow do not. Retention story is thin without any of them.

---

## What changed in the last 7 days (since 2026-04-12)

**Landed**
- Build 11: 17 F-track changes including joint meal-plan scaler, barcode caffeine/alcohol, source attribution, shopping-list lifecycle.
- Landing page SSOT + parity tests ([src/lib/landing/content.ts](src/lib/landing/content.ts), [tests/unit/landingParity.test.tsx](tests/unit/landingParity.test.tsx)).
- Server-side free-tier save cap + publish-tier gate (two new migrations staged).
- Mobile emoji → vector icons on weight-journey anchors + meal-slot icons (pinned by test).
- Voice-log Pro gate closed server-side.
- Weekly recap push live.
- Activity-level live preview in Settings.
- Household "share lunch" migration.
- Daily-target snapshot wiring.

**Walked back / removed**
- All seeded demo recipes deleted. `savedCount: 1247` hardcode gone; default is now `0`.
- Claims removed from landing and added to `FORBIDDEN_CLAIMS`: "400+ sources", "iOS, Android, web", "voice control", "$50/year", "app.suppr.co", "no questions asked".
- Pro bullets for "adaptive TDEE / macro trend reports" removed while the features are still ungated — decision pending.
- "Downgrade makes recipes read-only" softened to accurate copy.

**Upgraded from previous audit**
- Barcode scanning: stubbed → wired (OFF + user_foods).
- Sentry: missing → live on both platforms.
- CI: missing → full pipeline.
- Offline caching: none → mobile present (AsyncStorage, 24h TTL).
- Auth token refresh: unhandled → `onAuthStateChange` subscribed.
- Food diary: basic quick-add → MFP-style slots + streaks + favourites + saved meals.
- Mobile tests: 0 → 38 unit files + 24 E2E.
- `catch {}` on recipe save: now deletes orphan recipe on ingredient-insert failure.

---

## Top 10 improvements (priority order)

1. **Reseed Discover with 200–500 curated recipes** owned by a platform account. Import pipeline is strong — use it. Without this, every other growth effort is wasted.
2. **Provision RevenueCat offerings.** Dashboard config. Unlocks mobile revenue immediately.
3. **Close photo-log Pro gate on the server** — mirror the voice-log pattern.
4. **Converge onboarding to one canonical flow** across web and mobile. Either web grows to match, or mobile trims — pick one.
5. **Make `saveVerifiedIngredients` atomic** — Supabase RPC or compensation logic. Totals must not desync from ingredients.
6. **Launch-ready "Pro bullets" decision** — either gate adaptive TDEE + macro trend reports behind Pro or remove them from marketing. Current state ships unclaimed value.
7. **User recipe images on mobile** — unlock user-generated feed visuals.
8. **Household stabilisation** — close remaining edge-cases before marketing it.
9. **Food diary CSV export** — small build, large trust/retention signal.
10. **First community surface** — even just recipe ratings or saves-leaderboard — to give Discover a second loop.

---

## Final verdict — **Shippable core, content-starved shell** (7/10 concept, 6.5/10 production-readiness)

The technical reliability gap from the prior audit is substantially closed. Sentry, CI, offline cache, auth refresh, server-side tier enforcement, RevenueCat wiring, a real food diary, mobile test coverage — all landed in seven days. The core loop (import → verify → plan → shop → cook → log) is now trustworthy enough to put in front of users without qualifying it.

The new ship-blockers are different in shape: they're about the shell around the product, not the product itself. Empty Discover, unprovisioned IAP offerings, and one remaining server-side Pro gate leak are the three things standing between the current state and a defensible public launch. None of them require core engineering — the first is a seed-script run, the second is a dashboard config, the third is a copy-paste of the voice-log pattern.

**Not ship-blocking but competitive necessity:** community layer, household stabilisation, food diary export, mobile user-image upload, onboarding parity.

If the previous audit said "2–3 weeks of reliability engineering away from a compelling v1" — that work is now done. What's left is growth + monetisation wiring, not engineering depth.
