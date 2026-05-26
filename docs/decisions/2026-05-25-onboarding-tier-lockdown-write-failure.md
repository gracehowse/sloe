# Onboarding / Refresh-Plan silent write failure for paid users (tier-lockdown collision)

- **Date:** 2026-05-25
- **Area:** Onboarding · Persistence · Nutrition targets
- **Status:** Resolved
- **Severity:** P0 / launch-blocker (every paid user affected)
- **Platforms:** Web + mobile (shared `persist.ts`)

## Summary

For ~11 days (since the tier-lockdown trigger reached the live DB around
2026-05-14), **every paid user (`user_tier != 'free'`) who completed
onboarding or ran Settings → "Refresh my plan" had their entire profile
write silently rejected** — including `target_calories`. The UI showed no
error and navigated to Today as if the plan had saved, so the user stayed
on their OLD target. Reported by Grace (solo tester, `user_tier = 'pro'`):
"I set my plan to 900 but Today doesn't change." Confirmed against the
live DB: target frozen at 1,224 / `set_at = 2026-05-14`.

## Root cause

Three compounding defects, in order of blast radius:

1. **Onboarding upsert clobbered a locked column.** `buildProfileUpsertRow`
   in `src/lib/onboarding/persist.ts` hardcoded `user_tier: "free"`. On an
   existing row the upsert is an `UPDATE`, so for a `pro` user it tried to
   flip `pro → free`. The `profiles_tier_column_lockdown` **BEFORE UPDATE**
   trigger (migration `20260503100000`) raises `42501` when
   `new.user_tier IS DISTINCT FROM old.user_tier` for any non-service-role
   caller → the **entire row write was rejected**, targets and all.

2. **The failure was swallowed.** `persistOnboarding` catches the upsert
   error and returns `{ ok: false }`, but both `handleComplete` callers
   (`apps/mobile/components/onboarding/mobile-flow.tsx`,
   `src/app/components/onboarding/web-flow.tsx`) **ignored the result** and
   proceeded to seed recipes, fire `onboarding_completed`, and navigate
   home. A known-but-underestimated risk — see the prophetic comment at
   `SettingsBundleContent.tsx:1064` ("if persistOnboarding's upsert ...
   fails silently"). It assumed a rare edge case; it was a 100%
   deterministic failure for paid users.

3. **A latent Metro-only crash, unmasked by fixing #1.** `persistOnboarding`
   loaded the `goal_history` seed via a **dynamic** relative import
   (`await import("../nutrition/goalHistory")`). That specifier fails to
   resolve on Metro when `persist.ts` is pulled into the mobile bundle via
   the `@suppr/shared/onboarding/persist` alias ("Unable to resolve module
   ./src/lib/nutrition/goalHistory"). It was never reached before because
   the upsert (#1) always failed first and the seed sits behind
   `if (upsertError == null)`. Once #1 was fixed the upsert succeeded, the
   import ran for the first time, and threw — surfaced (correctly) by #2's
   new guard as "Couldn't finish setup".

## Fix

1. **Never write `user_tier` from the client.** Removed it from
   `ProfileUpsertRow` + `buildProfileUpsertRow`. The `profiles.user_tier`
   column `DEFAULT 'free'` covers brand-new-user inserts (the BEFORE-UPDATE
   trigger does not fire on INSERT); tier is owned exclusively by the
   server-side Stripe/RevenueCat webhooks — the only writers the lockdown
   trigger permits.
2. **Surface the write failure.** Mobile `handleComplete` throws on
   `!result.ok` (existing "Couldn't finish setup" alert, no navigation);
   web sets a visible `role="alert"` error (`data-testid=
   "onboarding-completion-error"`) and returns without navigating.
3. **Static import for the goal_history seed**, matching the sibling
   `persistRecomputedTargets.ts` (which already imports `goalHistory`
   statically and bundles fine on mobile; `goalHistory` only depends on
   `trackerStats`, so no circular risk). The `recordGoalHistory` call is
   additionally wrapped in `try/catch` so the best-effort seed can never
   break completion again.

## Why the goal/pace editor was NOT affected

`Targets → Edit goal & pace` (`GoalPaceEditorSheet` / `GoalPaceEditorDialog`)
persists via `persistRecomputedTargets`, which does a plain `.update()`
that never touches `user_tier` → the trigger sees no tier change and the
write lands. That path worked for paid users throughout.

## Verification

- Live DB after fix: `target_calories = 901`, `user_tier = 'pro'` (preserved,
  not clobbered), `set_at = 2026-05-26 04:17Z`.
- `tests/unit/onboardingPersist.test.ts` — asserts the upsert row never has
  a `user_tier` property + `persistOnboarding` returns `ok=false` on error.
- Web + mobile typecheck clean for all touched files (pre-existing
  `expo-file-system` mobile-typecheck errors in `SettingsBundleContent.tsx`
  / `exportEverything.ts` are unrelated — tracked separately).
- All onboarding vitest suites pass (web).

## Lessons / guardrails

- **Client code must never write entitlement/billing columns.** The
  lockdown trigger is correct; the client was wrong to send the column.
- **Never ignore a persistence helper's `{ ok }` result.** A write helper
  that returns a result instead of throwing must have every caller inspect
  it. Swallowed write errors hid this for 11 days.
- **No dynamic *relative* imports in shared code reachable from mobile.**
  Metro resolves static relative imports through the `@suppr/shared` alias
  but not dynamic ones. Class-of-bug sweep done 2026-05-25: the onboarding
  completion path has no other instances; the only other dynamic relative
  imports (`instrumentation.ts`, `AppDataContext.tsx`) are web-only.
- **Follow-up (separate):** `apps/mobile/lib/purchases.ts` `syncTierToSupabase`
  still `.update({ user_tier })` from the client — intentionally restricted
  per the lockdown migration header (relies on the RevenueCat webhook
  path); confirm it degrades gracefully rather than erroring loudly.
