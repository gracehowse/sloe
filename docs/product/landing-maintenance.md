# Landing / Pricing / Roadmap — keeping the marketing surfaces honest

Surfaces covered:

- `app/(landing)/LandingPage.tsx` — public `/` home page.
- `app/pricing/page.tsx` — public `/pricing` page.
- `app/roadmap/page.tsx` — `/roadmap` page (high-level themes only).

All three read from one source of truth: [`src/lib/landing/content.ts`](../../src/lib/landing/content.ts).

The parity test at [`tests/unit/landingParity.test.tsx`](../../tests/unit/landingParity.test.tsx)
renders the landing page and asserts it matches the SSOT, the real
algorithm constants, and the real changelog.

## How to change a claim

### Move a feature between tiers

1. Update the relevant list in `PRICING_TIERS` in `src/lib/landing/content.ts`.
2. **Add or remove the actual gate in code.** Landing copy must never promise a tier boundary that the server or client doesn't enforce.
3. Run `npx vitest run tests/unit/landingParity.test.tsx`.

### Ship a roadmap item

1. Move the item from the `Next` bucket to the `Now` bucket in `ROADMAP` and flip its status from `building` to `shipped`.
2. Add a changelog entry in `src/lib/changelog/entries.ts` — the `Now` bucket header reads `currentAppVersionLabel()` which pulls from this changelog, so bumping a build automatically updates the landing-page version label.
3. The parity test asserts every `shipped` item's text renders on the landing and fails if the same text appears in `building`.

### Change an algorithm threshold (e.g. TDEE)

1. Edit the constant in its home file (`src/lib/nutrition/adaptiveTdee.ts`).
2. Re-export from `src/lib/landing/content.ts` if it's new.
3. Update the relevant step body in `HOW_IT_WORKS` — the copy template interpolates the constant (`"once you've logged ${TDEE_MIN_LOGGING_DAYS} days and weighed in ${TDEE_MIN_WEIGH_INS} times"`).
4. The parity test pins rendered text to the constants, so forgetting step 3 will fail loudly.

### Add or remove a nutrition source

1. Add or remove the source in the real pipeline (`src/lib/nutrition/verifyIngredients.ts`).
2. Update `NUTRITION_SOURCES` in `src/lib/landing/nutritionSources.ts` (the leaf file re-exported from `content.ts` — lives in its own module so the mobile `apps/mobile/app/nutrition-sources.tsx` screen can import it without pulling web-only `@/...` deps).
3. Add a `SOURCE_DETAILS` entry (description + public URL) in `apps/mobile/app/nutrition-sources.tsx` — the mobile parity test (`apps/mobile/tests/unit/nutritionSourcesParity.test.ts`) asserts every SSOT source has a detail row.
4. The web parity test asserts the trust strip lists every SSOT source. (Adding a source without updating the trust strip is also enforced — the test renders the landing and checks every SSOT source appears.)

### Retire a marketing claim

1. Remove the claim from `LandingPage.tsx` and/or the SSOT.
2. Add the phrase to `FORBIDDEN_CLAIMS` in `tests/unit/landingParity.test.tsx` so it can't silently come back in a copy edit.

## Known monetisation gaps (product decisions needed)

The audit on 2026-04-19 found a set of features that the landing page used to promise as tier-gated but which the codebase does not actually gate. The landing copy has been rewritten to match code reality; these items are now captured here so product can decide whether to (a) add gates or (b) confirm they should remain free. **No landing-page claim has been made about any of these being tier-gated until a gate actually ships.**

| Feature | Current gating | Promised gating | Resolution |
|---|---|---|---|
| Adaptive TDEE | Ungated — everyone | Was listed as a Pro bullet | Landing copy removed the "Pro-only" claim; feature stays free. If product wants to gate it, add a `userTier === "pro"` check in `ProgressDashboard` and wire `ADAPTIVE_TDEE_PRO_ONLY` into the SSOT. |
| Activity-adjusted calories | Ungated | Was listed as a Pro bullet | Same as above — free-for-all until a gate lands. |
| Macro trend reports | Ungated | Was listed as a Pro bullet | Same — free until a gate lands. |
| Publish recipes publicly | Base+ (`isCreator = base \|\| pro` in `RecipeUpload.tsx`) | Was listed as Pro-only | Landing now promises this at Base (matches code). If product wants Pro-only, tighten the `isCreator` check and move the bullet in the SSOT. |
| Creator analytics | Not built | Was a Pro bullet | Roadmap status is `planned` (2026-04-19 sync-enforcer sweep — previously `building`, which falsely implied active scaffolding). The parity test's new `BUILDING_ANCHORS` check (see below) catches regressions. |
| Direct / priority support | Not enforced anywhere | Was a Pro bullet | Pro now says "Priority email support" — honestly minor ops work, no code change required, but copy is narrower. |
| AI photo meal recognition | Free taster (5/week) + Pro 100/day. Server-enforced via two independent rate-limit buckets — `api:photo-log:free-quota` (limit 5, window 168h) for non-Pro, `api:photo-log` (limit 100, window 24h) for Pro. Non-Pro: tap 6 returns 403 `upgrade_required` with `freeQuotaRemaining: 0`. | Free 5/week + Pro 100/day | 2026-05-02 (`docs/decisions/2026-05-02-photo-log-free-taster.md`) — flipped from blanket Pro-only to free-taster + Pro. The Cal-AI growth model gives every user a free shot of the AI before asking for money; we have the better feature (kcal ranges + verified DB) and were gating it before the user could taste it. Mobile + web dialog/sheet always opens; on 403 the host opens the `AiPaywallDialog` / `AiPaywallSheet` whose copy references the just-experienced quota. Free tier landing bullet: "AI photo logging (5 per week)". Pro bullet: "Unlimited AI photo meal recognition (100/day)". |
| Voice food logging | Server-gated Pro (`tier !== "pro"` → 403); 100/day Pro rate limit matches landing copy. | Pro | Base loophole closed 2026-04-19 — `POST /api/nutrition/voice-log` now rejects non-Pro tiers with `upgrade_required`, mirroring the client gate in `apps/mobile/app/(tabs)/index.tsx` and `voice-log-dialog.tsx`. |

## Building-item anchors (parity test)

The parity test at `tests/unit/landingParity.test.tsx` includes a
`BUILDING_ANCHORS` map: for every roadmap item whose `status ===
"building"` in `src/lib/landing/content.ts`, there must be a matching
entry in `BUILDING_ANCHORS` pointing at a real file in the repo. This
stops the landing page from advertising work-in-progress that has no
scaffolding (the exact failure mode that let "Creator analytics for
published recipes" sit as `building` without any code behind it).

When you move an item into the `Next` bucket with `status: "building"`:

1. Add the item's text → anchor path to `BUILDING_ANCHORS` in the test.
2. The anchor must resolve to a real file (or a non-empty directory)
   at test time. Prefer the most stable, load-bearing file for the
   feature — a hook, a screen, or a lib module.
3. If there is genuinely no anchor yet, the item should be `planned`,
   not `building`.

Conversely, when an item ships (`building` → `shipped`), remove its
row from `BUILDING_ANCHORS`; stale rows are tolerated (they no-op if
the text is not in the building set) but should be cleaned up.

## Shopping list — tier claim is satisfied *transitively* through the planner gate

The Base tier claim "Shopping list from plan" does not have a dedicated
gate in code. That is deliberate — the shopping list is only ever
generated from a plan spanning multiple days, and the multi-day plan
itself is gated at both platforms:

- Web: `src/app/components/MealPlanner.tsx:878` — `const locked = isFree && days > 1;` blocks Free users from picking `3` / `7` days.
- Mobile: `apps/mobile/app/(tabs)/planner.tsx:1044` (the `[1, 3, 7]` day-picker; anchor may shift +/- a few lines as surrounding code evolves — the logic is the same `locked = isFree && d > 1` branch).

Because a Free user cannot create a multi-day plan in the first place,
the shopping list that's derived from that plan never materialises for
them. No separate gate on the shopping-list screen is needed, and
adding one would duplicate the enforcement surface (two places to keep
in sync, each a potential drift source).

This is recorded as a product decision so future audits don't flag the
absence of a shopping-list gate as a monetisation hole: see
[`docs/decisions/2026-04-19-shopping-list-tier-gating.md`](../decisions/2026-04-19-shopping-list-tier-gating.md).

If the single-day-plan / shopping-list boundary ever changes (for
example, if Free users gain a single-day shopping list feature), the
planner-level gate no longer covers the shopping-list claim and a
dedicated gate needs to be added before the Base landing copy can
continue to promise it.

## `paywall_viewed.from` attribution (round 3, 2026-04-19)

The in-app upgrade panel opened by `src/app/App.tsx`'s `openUpgradePromo`
handler previously emitted `paywall_viewed` with a hardcoded
`from: "meal_planner"` regardless of which child component surfaced the
upgrade intent. That collapsed the F2 funnel slice across Library,
Profile, Shopping List, Recipe create/import, and Meal Planner call
sites.

The handler signature is now `openUpgradePromo(from, gateReason?)` with
`from` REQUIRED (not optional). TypeScript fails compile if any new
call site forgets it. The seven call sites inside `App.tsx` each wrap
the handler in an arrow that passes an explicit `PaywallViewedFrom`
literal:

| App.tsx call site | Literal |
|-------------------|---------|
| Meal Planner `onUpgrade` | `"meal_planner"` |
| Shopping List `onUpgrade` (in plan view) | `"shopping_list"` |
| Profile `onUpgrade` | `"profile"` |
| Library `onUpgrade` | `"recipes_library"` |
| Shopping List `onUpgrade` (standalone view) | `"shopping_list"` |
| Recipe Upload `onUpgrade` (create mode) | `"recipe_create"` |
| Recipe Upload `onUpgrade` (import mode) | `"recipe_import"` |

Enforcement lives in `tests/unit/paywallAttribution.test.ts`:

1. No bare `onUpgrade={openUpgradePromo}` reference remains in `App.tsx`.
2. Every `openUpgradePromo("…")` call passes a canonical
   `PaywallViewedFrom` string literal as its first argument.
3. Every `PaywallViewedFrom` value has ≥1 caller under `src/app/**` or
   `apps/mobile/app/**` OR is on an explicit `FROM_USAGE_WHITELIST`.
   Today's whitelist: `"trial_end"` (not-yet-shipped trial flow) and
   `"deep_link"` (load-bearing default branch of both platform
   `normalisePaywallFrom` helpers).
4. The signature shape is pinned — `from` cannot be made optional or
   given a default without the test failing.

### Adding a new `onUpgrade` entry point

1. Add the new surface to the `PaywallViewedFrom` union in
   `src/lib/analytics/events.ts`.
2. Add the matching `case "…":` branch to **both** `normalisePaywallFrom`
   helpers (`app/pricing/page.tsx` and `apps/mobile/app/paywall.tsx`).
3. At the new `onUpgrade` call site in `App.tsx`, wrap the handler in
   `onUpgrade={() => openUpgradePromo("new_surface")}`.
4. Run `npx vitest run tests/unit/analyticsEvents.test.ts tests/unit/paywallAttribution.test.ts` — the parity assertions will confirm the change is complete.

## `/account/billing` — Stripe Customer Portal (round 3, 2026-04-19)

`/account/billing` is a server component that opens the Stripe Customer
Portal for signed-in paid users. The decision tree:

1. Unauthenticated → redirect to `/login?redirect=/account/billing`.
2. No `profiles.stripe_customer_id` (Free user, or paid user who
   subscribed before the webhook started persisting the column) →
   redirect to `/pricing?ref=billing`.
3. `STRIPE_SECRET_KEY` unset → render a static support-email fallback
   (`support@suppr-club.com`). Never a 404, never a 5xx.
4. Stripe API call throws → same static fallback, error logged.
5. Happy path → redirect to `session.url`.

The column `profiles.stripe_customer_id` is populated by the
`checkout.session.completed` webhook (`src/lib/stripe/webhookProcess.ts`)
as a best-effort write so existing paid users backfill on their next
invoice / subscription event.

Pure decision logic lives in `src/lib/stripe/billingPortalDecision.ts`
and is covered by `tests/unit/accountBilling.test.tsx` — every branch
above has a dedicated test case.

The mobile app does not have a `/account/billing` equivalent; mobile
uses the App Store subscription-management sheet (opened via
RevenueCat's `syncPurchases` + the standard `Linking` deep-link to
`itms-apps://apps.apple.com/account/subscriptions`). The
`docs/product/subscriptions-stripe-and-iap.md` file is the canonical
cross-platform reference.

## Don'ts

- **Never** hand-edit a version number on the landing page. `currentAppVersionLabel()` reads the latest changelog entry.
- **Never** promote a feature to the `Now` bucket without an anchor in code (route, component, or test that proves it ships).
- **Never** list a source in the trust strip that isn't in `verifyIngredients.ts`.
- **Never** promise a refund window that isn't automated — the current policy is manual via Stripe within 7 days, framed honestly.
- **Never** claim Android support until the Android variant ships. The FAQ explicitly says Android is not on the roadmap; the roadmap bucket must stay aligned.
