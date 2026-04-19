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
2. Update `NUTRITION_SOURCES` in `src/lib/landing/content.ts` to match the user-facing order.
3. The parity test asserts the trust strip lists every SSOT source. (Adding a source without updating the trust strip is also enforced — the test renders the landing and checks every SSOT source appears.)

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
| Creator analytics | Not built | Was a Pro bullet | Removed from landing entirely until it exists. |
| Direct / priority support | Not enforced anywhere | Was a Pro bullet | Pro now says "Priority email support" — honestly minor ops work, no code change required, but copy is narrower. |
| AI photo meal recognition | Client-gated Pro; server rate-limited by tier (free 10/day, base 50/day, pro 100/day) | Pro | Landing correctly says Pro. Note that free users hitting the API directly can still use it — that's an API-authorisation gap, not a copy gap. |
| Voice food logging | Client-gated Pro; server blocks free tier (`tier === "free"` → 403) but allows Base | Pro | Landing says Pro. Base users hit the server route successfully; client guards the UI. Close the Base loophole if Pro-only is the intent. |

## Don'ts

- **Never** hand-edit a version number on the landing page. `currentAppVersionLabel()` reads the latest changelog entry.
- **Never** promote a feature to the `Now` bucket without an anchor in code (route, component, or test that proves it ships).
- **Never** list a source in the trust strip that isn't in `verifyIngredients.ts`.
- **Never** promise a refund window that isn't automated — the current policy is manual via Stripe within 7 days, framed honestly.
- **Never** claim Android support until the Android variant ships. The FAQ explicitly says Android is not on the roadmap; the roadmap bucket must stay aligned.
