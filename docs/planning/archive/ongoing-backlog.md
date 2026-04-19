# Ongoing backlog

**Purpose.** Single place for items Grace needs to action herself (dashboard / account), items waiting on a specialist review before implementation, and tech-debt flagged during recent sessions that isn't urgent enough to be in an active sweep.

**Not the same as.** `docs/planning/sweep-2026-04-executor-backlog.md` (structured orchestrator sweep, executor-driven). This file is for the long-tail.

**How to use.** Groups are priority-ordered within each section. When an item lands, strike it through and leave it for one session as a memory cue, then delete.

Last updated: 2026-04-19 (D&I audit — 6 fixes shipped, 3 P0s + several P1/P2s added below).

---

## 🔑 Grace only (dashboard / account work — no code needed)

These block launch. None of them can be done by an agent.

### Pricing + billing (Pattern A: Stripe web + RC iOS)

1. **Create RevenueCat account.** Connect your Stripe account under Integrations. (No RC dashboard exists yet as of 2026-04-19.)
2. **App Store Connect — four iOS subscription products** under bundle `com.supprclub.supprapp`:
   - `base_monthly` — $4.99 USD / £3.99 GBP
   - `base_annual` — $37.99 USD / £29.99 GBP
   - `pro_monthly` — $9.99 USD / £7.99 GBP
   - `pro_annual` — $74.99 USD / £59.99 GBP (with 7-day free trial)
3. **RC dashboard** — provision entitlements exactly `base` and `pro` (lowercase — these strings are hardcoded in `apps/mobile/lib/purchases.ts`). Provision one "current" offering with all four packages. Identifier hints in the code: `classifyPackage()` in `apps/mobile/app/paywall.tsx` accepts either `packageType` (`ANNUAL`/`MONTHLY`) or identifier substrings (`pro`/`base`, `annual`/`monthly`).
4. **RC API key** — generate iOS key → set `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` in EAS Secrets.
5. **Stripe dashboard** — create four GBP prices:
   - `STRIPE_PRICE_BASE_MONTHLY` — £3.99/month
   - `STRIPE_PRICE_BASE_ANNUAL` — £29.99/year
   - `STRIPE_PRICE_PRO_MONTHLY` — £7.99/month
   - `STRIPE_PRICE_PRO_ANNUAL` — £59.99/year
   Set all four in Vercel (production + preview).
6. **Stripe Tax** — activate in your Stripe dashboard, set `tax_behavior: "inclusive"` on all four Prices. Checkout already passes `automatic_tax: { enabled: true }` so this just turns the feature on.
7. **UK + EU VAT registration workstream** — per `docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md`. Outside-counsel engaged; Grace owns. Until registration lands, Stripe Tax in inclusive mode and the "Price shown includes any applicable VAT" disclosure cover the display requirement.

### Content seeding (launch ship-blocker from `PRODUCT_AUDIT.md`)

8. **Seed 200–500 curated recipes** via existing import pipeline under a "Suppr Picks" platform account. `scripts/seed-recipe-urls.txt` currently has 10 URLs; all prior demo content was deleted by migration `20260421180000`. New users will see a near-empty Discover until this runs.

---

## 🤝 Waiting on specialist review before I implement

### Analytics registry — paywall v2 events
- **Status:** `analytics-engineer` running as of 2026-04-19. Deciding register/reject + final payload shapes for candidate events from the `ui-product-designer` paywall spec §11:
  - `paywall_tier_viewed`, `paywall_period_changed`, `paywall_skipped_already_entitled`
  - `checkout_started` / `checkout_completed` firing from mobile paywall (web already fires these)
- **Unblocks:** adding these to `src/lib/analytics/events.ts` + wiring into `apps/mobile/app/paywall.tsx`. No funnel is broken by their absence today; `paywall_viewed` still fires correctly.

### Legal — paywall v2 disclosure copy
- `legal-reviewer` hasn't signed off on the new mobile paywall disclosure copy ("7 days free, then {price} per year, automatically renewing until cancelled in App Store settings. Price includes any applicable VAT. 7-day refund policy: support@suppr-club.com") or on the web disclosure rewrite ("Price shown includes any applicable VAT" replacing "excludes any applicable taxes").
- **Unblocks:** final pre-launch sign-off. Code copy may shift per review.

### D&I audit — P0 items needing product / legal / data-integrity input
From `docs/decisions/2026-04-19-diversity-inclusion-audit.md`. The audit's P0 dead-name fix shipped this session; these three remain.

- **DI-P0-01 — Allergen surfacing on recipes.** New `allergens[]` column; auto-populate from ingredient list; surface "Contains" on every recipe detail screen; never paywalled. Needs `nutrition-engine` (confidence model), `data-integrity` (schema + RLS), `legal-reviewer` (FDA-compliant "Contains" / "May contain" wording). Safety-critical; explicitly P0.
- **DI-P0-02 — Separate gender identity + pronouns fields.** Product currently collects only "Biological sex" (F/M/Prefer not to say). Add `profiles.gender text null` + `profiles.pronouns text null`. Settings exposure + optional onboarding step. Pronouns, once set, must propagate through every addressed-user surface — pin with a test. Needs `data-integrity` (migration), `journey-architect` (placement), `copy-reviewer` (pronoun-correct microcopy pass), `sync-enforcer` (web/mobile parity). Open product-lead question: optional in onboarding vs settings-only launch.
- **DI-P0-03 — Hide weight / trends-only mode on Progress.** Weight is currently a default-on 3-tile surface with no opt-out — largest ED-risk / dysphoria surface in the product. Add `profiles.weight_surface_mode` (`show`/`hide`/`trends_only`), gate Weight Card + Projection Card + Trend tile on both platforms. Open product-lead question: what metric replaces the Trend tile in Hide mode (logging consistency, fibre, hydration?).

### UI / design — unresolved open questions from paywall spec §15
- **Header kicker copy.** Spec defaults to `SUPPR PRO` (Pro-flavoured) / `CHOOSE YOUR PLAN` (neutral). `ui-critic` may want to retire the kicker entirely — calm > shouty.
- **Base-upgrader delta chip** on Pro card ("+£X/mo"). Spec defaults to skip due to currency fragility; Grace product-lead call needed.
- **`from=meal_planner` default focus.** Meal planner is a Base-gated feature; spec keeps Pro as hero regardless, but there's an honest tradeoff between consistency and context-accuracy.

---

## 🧹 Tech debt flagged but not urgent

### Region-aware pricing
- Hardcoded GBP in `PRICING_TIERS` is acknowledged-as-bug-vs-intent (see `project_region_aware_pricing` memory). Apple's `priceString` handles real locale on iOS; web shows a single GBP view.
- **What's needed:** detect user region (Accept-Language / IP geolocation), pick the right currency ({USD/GBP/EUR/…}) + tax disclosure wording at render time. Non-trivial — needs a spec.
- **When:** after launch, or earlier if tickets start landing about "why is this showing £ when I'm in the US?"

### `saveVerifiedIngredients` atomicity
- `apps/mobile/lib/verifyRecipe.ts:~1005` writes totals first (`is_verified: true`), then loops per-ingredient. If one ingredient update fails, totals are verified against an inconsistent ingredient set.
- **Fix:** Supabase RPC that wraps totals + ingredient writes in a transaction. Needs `data-integrity` review of the RPC signature.

### Residual `catch {}` patterns
- `apps/mobile/lib/verifyRecipe.ts:843` and a handful of other spots still swallow errors without routing to Sentry. Low severity but drift risk.

### Onboarding divergence (web 4 steps vs mobile 11 steps)
- `app/onboarding/page.tsx#L270` vs `apps/mobile/app/onboarding.tsx#L71`. Violates the non-negotiable "no accidental divergence" rule.
- **Fix:** convergence to one canonical flow. Needs `ui-product-designer` spec first.

### Household feature regressions
- Build 10 fixed a `multiple-rows` error. Surface still maturing. Needs an enumeration of remaining edge cases + regression tests before heavy marketing.

### Food diary CSV export
- Requested category feature; not built. Small build, strong trust signal. Low priority vs launch-critical items.

### First community surface
- Saves counter exists; comments, ratings, follow graph do not. Strategic decision — pick one loop (ratings vs leaderboard vs follows) rather than building all three.

### Weekly recap push test drift
- `tests/unit/weeklyRecapPushRoute.test.ts:194` expects `{ deepLink, kind }`; production code emits `{ deepLink, kind, weekKey }`. Test was not updated when `weekKey` was added. Either the test adopts `weekKey` or the emit drops it — a `product-lead` call on whether the deep-link should carry the week key. Low-severity drift, single test failure; doesn't block CI if the branch is green elsewhere.

### Mobile Base-tier purchase E2E test
- New paywall ships with Base + Pro × monthly + annual. Currently no automated end-to-end purchase test because RC offerings aren't provisioned yet (Grace dashboard work above). Once provisioning lands, add Detox/Maestro test.

### `ui-product-designer` paywall spec §15 — "kicker retirement" review
- Route to `ui-critic` for a sanity check on whether the SUPPR PRO kicker should survive at all. Low priority; current spec is defensible.

### D&I audit — P1 / P2 backlog
From `docs/decisions/2026-04-19-diversity-inclusion-audit.md`.

- **DI-P1-01 — Streak-visibility Settings toggle.** Landing FAQ copy is now truthful ("shows after your first day logged") but there's still no user control to suppress it. Add `profiles.streak_display_enabled boolean default true` and gate `TodayStreakInsightCard`, the Progress streak tile, and `WeeklyRecapCard` streak line. Consider flipping default to `false` once the toggle exists.
- **DI-P1-02 — Soften onboarding projection headline on Lose branch.** `apps/mobile/app/onboarding.tsx:872-902` currently renders *"You could reach [weight] by [date]"* at 28pt. Rewrite to factual *"At [pace] pace, this plan reaches your goal around [date]."* with reduced weight emphasis. Owner: `copy-reviewer` + `ui-product-designer`.
- **DI-P1-03 — Web Progress parity for hide-weight mode.** Tied to DI-P0-03. Same gating on `src/app/components/ProgressDashboard.tsx`.
- **DI-P2-01 — Expand religious dietary preferences.** Add `jain`, `hindu-vegetarian`, `buddhist-vegetarian` to `src/constants/dietaryPreferences.ts`. Separate "fasting windows" concept (Ramadan, Lent) deferred.
- **DI-P2-02 — Explain BMR safety floor for unspecified sex.** `src/lib/nutrition/tdee.ts:100-107` uses a midpoint (1350 kcal) for `unspecified` with no in-product explanation. Owner: `nutrition-engine` — surface "Adjust safety floor" or a one-line explanation.
- **DI-P2-03 — "Why we ask" helper under Biological sex step.** Current helper `"Used for BMR calculation only"` → *"We use this to estimate your resting metabolic rate. You can skip this or change it anytime in Settings. If you pick 'Prefer not to say' we use a midpoint estimate."*
- **DI-P2-04 — Household push payload outing-risk pre-ship check.** When meal-add / shared-list notifications ship, payload must not include other members' `display_name`. Add to `release-gate` checklist.
- **DI-P3 forward-looking.** Cuisine-naming policy (respectful origin names, never "Asian / ethnic / international"); landing imagery review when human photography ships; optional English-only FAQ line.

### `PRICING_TIERS` leaf extraction — further SSOT consolidation
- `PRICING_TIERS` is now a leaf; `FREE_SAVE_LIMIT` is imported relatively. Other landing constants (`ROADMAP`, `FAQS`, `HOW_IT_WORKS`) still live in `content.ts` with `@/` aliases. If mobile ever needs those too, repeat the leaf pattern.

---

## 📋 Session log

- **2026-04-19 (later same day):** First D&I + a11y audit. Shipped 6 fixes (P0 household dead-name live-join, default sex `unspecified` for skippers, onboarding back-button label, `prefers-reduced-motion` on landing + mobile, 44pt touch target on unit toggle, landing streak-FAQ honesty rewrite) + 3 new test files pinning them. Three P0s + several P1/P2s tracked above. Full audit: `docs/decisions/2026-04-19-diversity-inclusion-audit.md`. New `diversity-inclusion` specialist agent available at `.claude/agents/diversity-inclusion.md` (bookable after Claude Code restart).
- **2026-04-19 (this session):** Pricing v1 shipped; mobile paywall full redesign per ui-product-designer spec; VAT-inclusive disclosure fix on web; photo-log Pro gate closed server-side; PRICING_TIERS leaf-extracted for mobile.
- **Prior session:** `PRODUCT_AUDIT.md` re-run; Pattern A billing architecture decision; pricing v1 pricing table finalised.
