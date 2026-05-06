# Debug audit decisions — 2026-05-05

> Six product decisions resolved by Grace on 2026-05-05 in response to the open questions surfaced by [`docs/audits/2026-05-05-debug-audit/findings.md`](../audits/2026-05-05-debug-audit/findings.md). One item deferred to Notion task.
>
> Status: **Resolved.** These supersede any conflicting prior memory or doc.

## 1. "Deficit" math = `burn − consumed`

The current shipped TodayDeficitInsight formula (`burn − consumed`) is canonical. This is the honest physiological deficit — calories out minus calories in.

**Implication for fix:** anywhere a surface labels `goal − consumed` as "deficit", rename to "remaining". The calorie ring's centre value (when in remaining mode) is "remaining", never "deficit". Activity Bonus card's "Net deficit" tile and TodayDeficitInsight banner stay as-is.

Supersedes: any briefing claim that the 2026-05-05 fix landed `goal − consumed` as canonical.

## 2. "Snap a meal" CTA hides after first meal

The Today snap shortcut is an empty-day prompt, not an always-on speed-logger. Hide once `mealsToday.length >= 1`. Web + mobile parity.

**Why:** four logging entry points (FAB, snap shortcut, meal-slot taps, quick-log strip) competed for the same action. The shortcut earns its space only when the user hasn't started yet.

## 3. Single kcal/kg-of-fat constant: 7700

`KCAL_PER_KG_FAT = 7700` is the only constant. The Activity Bonus card's `weekDeficit / 3500 × 0.4536` path is replaced with the shared 7700 helper.

**Why:** onboarding pace promises are computed at 7700; Today projections must honour the same number. ~0.2% drift was small but observable across surfaces.

**Implementation note:** centralise via `weekDeficitToKg(weekDeficit)` helper imported by both web + mobile cards. `whyThisNumber.ts`, `deficitProjection.ts`, `weightProjection.ts` already use 7700 and need no change.

## 4. Stripe Tax — jurisdiction-aware (deferred to Notion)

Tax behaviour must change with jurisdiction: UK/EU inclusive, US handled by Stripe Tax automatic, copy reflects the region.

**Status:** deferred from the depth-audit fix-batch by Grace 2026-05-05. Tracked at https://www.notion.so/35859b4150308164a858d4bb71d6295b (Tasks DB, P1).

Three workstream pieces:
1. `STRIPE_TAX_ENABLED=true` in Vercel production env.
2. `tax_behavior=inclusive` on Pro monthly + Pro annual Price objects in Stripe dashboard for UK/EU; US uses Stripe Tax automatic.
3. `BillingDisclosure` copy must NOT render "Prices include VAT" unconditionally when the env flag is off. Wire the copy to flag state.

**Why deferred:** legal-reviewer sign-off needed before flipping the env flag; not a one-line code fix.

## 5. Web post-checkout: Supabase Realtime subscription

The fix for the web "Free tier UI right after paid checkout" race uses a Supabase Realtime subscription on `profiles.user_tier`, not a delayed poll.

**Why:** Realtime is the structurally-right answer — doesn't depend on guessing how long Stripe takes; updates the moment the webhook commits. We already use Supabase Realtime elsewhere in the app.

**Implementation:** AppDataContext subscribes to changes on `profiles.user_tier` for the current session; updates context state on any change event. The `?checkout=success` query param is the trigger to start subscribing if not already active.

## 6. Onboarding v2 → canonical rename — already done; small cleanup remains

**Status correction:** the big v2 → canonical rename shipped on 2026-04-30 in commit `080c90a`. Initial reading of the audit findings claimed this was a multi-hour pending refactor; on inspection, the rename is complete.

Current state on `main`:
- `/onboarding` is the canonical route + screen
- `/onboarding-v2` is a thin `<Redirect href="/onboarding" />` for backwards compatibility (21 lines)
- `apps/mobile/components/onboarding/`, `src/lib/onboarding/`, `src/app/components/onboarding/` are flat (no `v2/` subdir)
- Symbols renamed: `OnboardingProvider`, `useOnboarding`, `persistOnboarding`, `OnboardingState`
- Test pin `onboardingV2Redirect.test.ts` verifies the redirect works

PRESERVED for data continuity (correct):
- PostHog flag `onboarding_v2`
- Analytics event names containing `v2`
- Database column names

**Remaining cleanup for fix-batch:**

1. UI-string sweep — confirm no user-visible "v2" leaks across mobile + web. Most surfaces already clean via `STACK_HEADER_HIDDEN` (commit 85199b1).

2. Backwards-compat redirect decision: keep `apps/mobile/app/onboarding-v2.tsx` as a defensive shim (old TestFlight builds, cached push deep links) OR delete after confirming no external callers. **Recommend keep** — cost is 21 lines; risk of breaking a cached deep-link path is real.

3. Morning sweep finding A3 ("dead deep-link") was capture-side (captures taken before redirect was on the device build). Not a real bug. The test pin verifies the redirect works.

Memory pointer: `project_v2_rename_pending.md` (updated 2026-05-05 with the corrected status).

## 7. AsyncStorage cross-user leak — fix now

The signOut handler will clear non-profile AsyncStorage keys (`cachedUserTier`, `WRITTEN_IDS_KEY`, `FOOD_HISTORY`, `EAT_AGAIN_LEGACY_KEY_V1`, `SLOTS_STORAGE_KEY`, `ACTIVE_SLOT_STORAGE_KEY`, `health_sync_apple_connected`, `health_import_*`, `health_export_*`, `NOTIFICATIONS_PROMPT_DISMISSED_KEY`, `LAST_PUSH_TOKEN_CACHE_KEY`, `FIRST_LOG_LOCAL_KEY`, `FirstRunChecklist`, `cookHandsfree`, theme pref, onboarding context state).

The HealthKit-written-IDs set will additionally be userId-keyed at write time so re-signin under a different user doesn't suppress legitimate writes.

**Why now:** structurally broken. The N=1 solo-tester carve-out protects today, but the architecture relies on it staying solo. Fixing now is ~90 minutes of work; finding out the hard way after a second tester signs in is more expensive.
