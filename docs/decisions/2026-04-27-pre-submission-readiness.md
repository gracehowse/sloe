# Pre-submission readiness — 2026-04-27

**Date:** 2026-04-27
**Status:** Resolved (audit + scope work complete; remaining items are Grace ops + backlog with full specs)
**Trigger:** Grace's request to action all 15 outstanding engineering items in one push. This doc captures the audit findings + scope decisions from that batch.

---

## What shipped today (engineering, in code)

### Onboarding cleanup

- `app/onboarding/page.tsx` — simplified to unconditional `redirect("/onboarding/v2")`. The `?legacy=1` escape hatch + `searchParams` reading + `LegacyOnboardingForm` import are gone.
- `app/onboarding/legacy-form.tsx` — gutted to a tombstone (`export {}` only). The 1-week validation window from `2026-04-27-delete-legacy-onboarding.md` closed today with no v2 regressions; safe to `git rm` in any subsequent branch.
- `src/lib/analytics/track.ts` — removed `isOnboardingV2Enabled` + `subscribeToFlags` (sole consumer was the deleted legacy form). Mobile keeps its own copies in `apps/mobile/lib/analytics.ts` because the mobile onboarding-v2 ramp is on a separate track.
- `middleware.ts` — removed the `/onboarding/v2` entry from `DEV_PREVIEW_PREFIXES`. Onboarding-v2 is the canonical sign-up entry and already lives in `PUBLIC_ROUTES`; the dev-preview entry was a leftover from the testflight ramp window. Public-route allowlist is now the single source of truth.

---

## Tiering audit (Base vs Pro)

Reviewed `apps/mobile/app/paywall.tsx` + `apps/mobile/tests/unit/paywallFeaturesParity.test.ts` + `supabase/migrations/20260426100100_recipes_publish_tier_gate.sql` to settle which features sit behind Base vs Pro.

### Free tier
- Today (calorie + macro tracking)
- Basic recipe save (capped at 10 saves via `saves_free_tier_cap` RLS)
- Discover browse (read-only)
- Basic ingredient match (USDA/OFF only; FatSecret-Basic-zeroed)
- Manual logging only

### Base tier (£X/month — paid)
- Unlimited recipe saves
- Recipe imports from URL / paste
- 7-day meal plan (single named slot)
- Apple Health read (steps, weight, active energy)
- Voice + photo logging
- Net-carbs lens

### Pro tier (£Y/month — paid, ~2× Base)
- Multiple named meal-plan slots
- Activity-adjusted calorie targets (adaptive TDEE)
- Apple Health write (Nutrition Sync)
- Apple Watch complication + iOS widget
- Weekly recap push (web + mobile)
- Recipe import from social (TikTok / Instagram OCR)
- Joint-fit macro scaler ("hit my protein target this week")
- Priority FatSecret access (when Premier lands)
- Household / shared dinners (when paid Premier)

### Free → Base upsell triggers
- 10th save attempt
- First plan generation request
- First recipe import

### Base → Pro upsell triggers
- Apple Health write request
- Adaptive TDEE configuration
- Multiple named slots
- Watch complication setup
- Social import attempt

**Action for Grace:** confirm price points + map these features into RevenueCat dashboard offerings + entitlements. The mapping above is the canonical list.

---

## Onboarding v2 scope reconciliation (T9 / T10 / T9-T11)

Reviewed `docs/decisions/2026-04-19-onboarding-redesign-scope.md` against the current implementation in `src/app/components/onboarding-v2/` (web) and `apps/mobile/app/onboarding.tsx` (mobile).

### Phase A (auth + persistence) — SHIPPED
- Real Supabase signUp at step 02 (web)
- Apple sign-in path wired
- Profile persistence across the flow
- Resume-on-return logic (cookie + Supabase session check)

### Phase B (import + polish) — SHIPPED
- HealthKit / push permission prompts (mobile)
- Recipe import flow (URL + social)
- Polish copy refinements per UI consistency rounds 1+2+3
- `setTimeout` placeholders replaced with real async operations

### What remains (genuinely outstanding)
- **Mobile ramp** — onboarding_v2 PostHog flag is gated; ramp 0→10→50→100 is its own ticket (T11) and post-launch sequence
- **`apps/mobile/lib/analytics.ts` helpers** — `isOnboardingV2Enabled` / `subscribeToFlags` stay until mobile ramp completes
- **Redesign Phase 3 (Today screen v2)** — separate post-launch initiative (see backlog scopes below)

**Verdict:** Phase A + Phase B are functionally complete. Resolve T9 / T10 / T9-T11 as Done. The ramp work is tracked under T11 and will close progressively post-launch.

---

## T25 — Pre-submission re-sweep verdict

**Status: cleared for submission, pending Grace ops.**

Engineering coverage of the 28 lenses:

| Lens | Status |
|---|---|
| Schema integrity | ✓ All migrations applied through 20260503102000 |
| Auth + RLS | ✓ Profiles lockdown shipped P0-4; tier-write lockdown verified |
| Rate limiting | ✓ 16 endpoints scoped per-user via RateLimitOptions.userId (P0-6) |
| Tests + CI | ✓ 200+ tests green; npm run ci local-mirror; gh run watch on push |
| Mobile parity | ✓ Web ↔ mobile algorithm + helper dedup (P1-9, P2-28) |
| Recipe import | ✓ ALL-CAPS + caption-leak + idempotency by source_url shipped |
| Search | ✓ Tokenized AND match (round 1) |
| Match accuracy | ✓ FatSecret zero-cal guard, FatSecret-Basic zeroing |
| Planner | ✓ Portion clamp tightened, fallback re-sample, sampler cap 2k |
| Macro display | ✓ formatMacro centralised; 105.80000000000001 bug closed |
| UI consistency | ✓ 28-item audit closed across 3 polish rounds |
| Library prominence | ✓ Promoted to a primary tab |
| Hydration / stimulants | ✓ +chip persist hardened with rollback + Alert |
| Allergen surfacing | ✓ T12 shipped + 'Contains:' callout |
| RevenueCat webhook | ✓ Code shipped + live-replay smoke confirmed |
| Web push (weekly recap) | ✓ Code + VAPID keys all live |
| Sentry + PostHog | ✓ Mobile observability complete (P1-13) |
| Decision docs | ✓ All 28+ decisions logged in /docs/decisions |
| Notion mirror | ✓ Roadmap + Decisions log + Tasks all current |
| App Store listing | ⚠ Copy scaffold ready; screenshots from latest builds pending Grace |
| RevenueCat offerings | ⚠ Code ready; dashboard provisioning pending Grace |
| TEMP SEED purge | ⚠ Script ready; Grace runs `npx tsx scripts/delete-seeded-recipes.ts` |
| Stripe credit | ⚠ Activation pending Grace |
| Trademark TM-1 | ⚠ Counsel decision pending — gates rebrand |
| Tax notes | ⚠ Pending incorporation jurisdiction |
| Azure credits | ⚠ Time-bound (claim before 9 May) |

**Cleared for submission once the four ⚠ asterisks tied to App Store + RevenueCat are handled.** TM-1, tax notes, and credits are post-submission ops.

---

## App Store listing — copy refresh checklist

The scaffold lives at `docs/launch/app-store-listing.md` (P1-16). For Grace's submission session:

1. **App name:** "Suppr" (assumes TM-1 lands; otherwise "Suppr Club")
2. **Subtitle:** "Real-recipe macro tracking" (40-char Apple cap)
3. **Description:** keep current scaffold; refresh "What's new" with round-1+2+3 polish highlights:
   - "Library prominence + tab promotion"
   - "Hydration + caffeine reliability — chip-tap now persists or surfaces an error"
   - "Recipe import: smarter title cleanup, caption-leak fixed"
   - "Macro display precision (no more 105.80000000000001g floats)"
   - "Tighter meal plans (whole/half portions only)"
4. **Screenshots:** capture from latest builds — Today (with macro tiles), Discover (with macro icons), Library (with new tile parity), Plan (with named slots), Progress (with weekly digest). 6.5" + 5.5" device sizes.
5. **App preview video:** optional but lifts conversion ~15%. 30s ungated tour.
6. **Keywords:** macro, recipe, meal, plan, calorie, protein, carbs, fat, nutrition, fitness
7. **Privacy nutrition (Apple):** match `app/privacy/page.tsx` — Health (HealthKit), Identifiers (auth), Purchases (RevenueCat), Diagnostics (Sentry), Usage Data (PostHog).

---

## F-73 cortado fix-path (post-launch v1.1)

**Root cause:** Searching "cortado" returns USDA Branded "Cortado" (Spanish cheese) because there are no first-class generic rows for common coffee drinks; USDA Branded entries outrank Foundation/Survey for unusual queries.

**Fix shape:**
1. New migration `seed_generic_beverages.sql` adding ~12 rows to `public.foods` for: Cortado, Flat white, Cappuccino, Latte, Espresso (single + double), Americano, Macchiato, Mocha, Drip coffee, Pour-over, Cold brew. Each with verified per-100g macros + corresponding `food_sources` rows pointing at curated nutrition.
2. New helper `genericBeverageMatch(query: string)` in `src/lib/nutrition/genericBeverages.ts` that returns the seeded row when the query exactly matches a known beverage name (case-insensitive, after normalisation).
3. Wire `genericBeverageMatch` into the search ranker (`apps/mobile/lib/foodSearch.ts` + web equivalent) ABOVE USDA Branded, so a "cortado" query lands the seeded row first.
4. Tests pinning the contract.

**Effort:** S/M (4-6 hours including tests). Not launch-blocking. Schedule for post-launch v1.1 once Premier Free FatSecret approval lands (auto-complete may resolve a chunk of the same class organically).

---

## Backlog scope-docs (5 multi-week items)

These are real engineering initiatives, not polish items. Each has a one-paragraph scope so the work can start cleanly when prioritised.

### Discover feed depth (creator profiles, advanced filters)
**Scope:** creator-profile pages (`/creator/[id]`) with bio, recipe grid, follower count, follow button. Filter chips on Discover for cuisine / cook-time / dietary preset. Saved-creators sub-tab. Effort: M (1-2 weeks). Dep: requires creator_follows table to be live (already in `20260503101000_schema_drift_repair.sql`).

### Weekly fiber + hydration adherence rollups
**Scope:** extend the weekly recap (route `/api/push/weekly-recap`) to include: (a) avg fiber as % of target, (b) avg hydration ml/day, (c) days-on-target counts. UI on Progress page sub-card. Effort: S (3-4 days). Dep: extends existing protein adherence shape.

### Spike Google Fit / Health Connect for Android
**Scope:** parallel adapter alongside HealthKit at `apps/mobile/lib/healthSync.ts`. Read parity for steps, weight, active energy, resting energy, workouts. Write parity for nutrition sync. Effort: L (3-4 weeks). Dep: Android Expo setup + dev account. Re-evaluate after iOS launch traction.

### Strava / Garmin partner APIs
**Scope:** OAuth flow per partner + webhook subscription + per-user auth-token persistence + activity-data ingestion + dedup against Apple Health workouts. Effort: M per partner (1-2 weeks each). Dep: partner developer accounts + production OAuth review. Re-evaluate when there's user pull.

### Today screen Phase 3 redesign
**Scope:** v2 visual treatment of Today (per `docs/decisions/2026-04-19-onboarding-redesign-scope.md` Phase 3 section). Specific surfaces TBD but expected to include: condensed top-of-screen, eat-again prompt repositioning, integrated quick-add (no FAB if redesign goes that way). Effort: M (1-2 weeks). Dep: post-launch retention data showing what surfaces actually drive engagement.

---

## Outcome

15 of 15 items either shipped or fully scoped:
- 4 engineering changes shipped in code (onboarding cleanup, middleware revert, web helpers, page redirect)
- 4 audit/reconciliation deliverables produced as the sections above
- 5 backlog items scope-doc'd with effort estimates + dependencies + re-evaluation triggers
- 2 Grace-ops items handed off with crisp instructions (App Store, RC offerings)

Submission posture: cleared for App Store submission once Grace's four ops items land (TEMP SEED purge, RC offerings, App Store listing, app preview screenshots).

The 5 multi-week backlog items are now spec-ready — any future contributor can pick one up without further scoping.
