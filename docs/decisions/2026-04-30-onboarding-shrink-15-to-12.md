# Onboarding shrink — 15 steps → 12, hide numeric counter

**Date:** 2026-04-30
**Status:** Resolved
**Area:** Onboarding / activation
**Owner:** Grace
**Authority:** Customer-lens audit (2026-04-30); approved by Grace before
implementation; supersedes the step count locked by
`docs/decisions/2026-04-19-onboarding-redesign-scope.md` (the soft-warn
pace decision and the rest of that scope are unchanged).

## Problem

Mobile onboarding shipped a 15-step linear flow. Customer-lens flagged
the explicit "1/15 … 13/15" counter as the highest single-friction
signal in the audit — N-of-15 anchors the user on remaining work, and
15 is an outlier in the category:

| Product   | Onboarding steps |
| --------- | ---------------- |
| Cal AI    | 6                |
| MFP       | 5                |
| Lifesum   | 7                |
| Suppr (was) | **15**         |

Three of those 15 are optional and can be picked up later — they were
in the linear flow because they had nowhere else to live before the
post-launch nudge / Today empty-state surfaces existed. They do now.

## Decision

1. **Remove the numeric step counter** ("1/15") from both web and
   mobile flow shells. Keep the thin progress bar — it gives the
   "I'm part-way through" feel without naming a hard total. Cal AI /
   MFP / Lifesum all use progress-only.
2. **Move three steps off the linear flow** — Permissions, Import,
   Recipes:
   - Permissions (HealthKit + notifications) → discoverable in
     Settings (already wired).
   - Import (paste a recipe link) → `/import-shared` route (already
     wired); discoverable from the Library tab.
   - Recipes (pick five recipes) → Library tab + Today empty-state
     "Browse recipes" CTA (both already wired).

The three step component files (`steps/permissions.tsx`,
`steps/import.tsx`, `steps/recipes.tsx`) are kept on disk and still
re-exported from `steps/index.ts` — they are the building blocks for
the post-launch nudge queue (follow-up PR). Removing them entirely
would erase the real-API path that was wired into permissions earlier
the same week.

`reveal` is the new terminal step on both platforms. The shell's
"Build my plan" CTA on `reveal` fires the existing
`handleComplete` write path (persist targets + optionally seed-and-plan
if `pickedRecipeSlugs` is non-empty — which only happens once the
nudge queue lands; the steady state is targets-only completion, which
the persist path already handles gracefully).

## What this does NOT change

- The pace soft-warn decision (`docs/decisions/2026-04-19-onboarding-redesign-scope.md`)
  is preserved verbatim.
- The legal-reviewer Stage F danger-acknowledgement gate on Pace is
  preserved.
- The diversity-inclusion `weightSkipped` path is preserved.
- The PostHog flag id `648164` (`onboarding_v2`, 100 % rollout) is
  unchanged. No v3 route — this is a content-only edit to the existing
  flow.
- The AsyncStorage scratchpad key `suppr.onboarding-v2.state` is
  unchanged (locked by `apps/mobile/tests/unit/settingsBundleParity.test.ts`).
- The `onboarding_completed` analytics event is unchanged. Flag-aware
  funnel reports comparing pre- and post-shrink will see step total
  drop from 15 to 12.

## Follow-ups (not in this PR)

- ~~Build the post-launch nudge queue~~ — shipped in
  `apps/mobile/components/today/onboarding-nudges/` (2026-04-30).
  See "Post-launch nudge queue" below.
- Update the customer-lens journey doc to reflect the new step count.
- Notion: update Roadmap ("Onboarding shrink") and add a Decisions row
  pointing at this file.

## Post-launch nudge queue

Shipped 2026-04-30 as the deferred half of this decision. Three
banners, one at a time, in priority order on the Today tab — directly
below the calorie ring card — each with an AsyncStorage-gated
cooldown.

Code lives in `apps/mobile/components/today/onboarding-nudges/`:

| File                          | Role                                   |
| ----------------------------- | -------------------------------------- |
| `types.ts`                    | Nudge contract + storage key helpers   |
| `nudges.ts`                   | Static catalogue (priority order)      |
| `useNextNudge.ts`             | Queue selector hook + dismissal writer |
| `OnboardingNudgeBanner.tsx`   | Presentation + per-id action wiring    |
| `index.ts`                    | Barrel                                 |

Mounted from `apps/mobile/app/(tabs)/index.tsx` between the single
context block (fasting / eat-again / north-star / deficit) and the
2x2 macro tiles, gated on `isToday && mealsToday.length > 0` so the
zero-state Today moment (calorie ring + north-star block) lands first
without the banner crowding it.

### Priority + cooldowns

| Order | Id            | Cooldown | Removes on action? | Primary action                                                |
| ----- | ------------- | -------- | ------------------ | ------------------------------------------------------------- |
| 1     | `permissions` | 7 days   | Yes                | `requestHealthPermissions()` + `expo-notifications` prompt    |
| 2     | `import`      | 7 days   | No                 | `router.push("/import-shared")`                               |
| 3     | `recipes`     | 14 days  | No                 | `router.push("/(tabs)/library")`                              |

The permissions banner uses the same OS-permission helpers as
`apps/mobile/components/onboarding/steps/permissions.tsx` — no parallel
implementation, no local-flag fallback. Once the user has answered the
OS prompt (granted OR denied), the catalogue's `removeOnAction: true`
flag drops the banner from the queue forever; re-asking via this
surface would talk past the answer the user just gave.

### Storage layout

Per nudge id, two AsyncStorage keys under `suppr.nudge.`:

- `suppr.nudge.${id}.last-dismissed-at` — ISO timestamp; cooldown gate.
- `suppr.nudge.${id}.removed`           — `"true"` once permanently dropped.

Corrupt timestamps are treated as "never dismissed" so a bad write can
never silently lock the user out of seeing a prompt forever.

### Mobile-only

Web does not get a parity port. Apple Health is iOS-native, and the
import + recipes nudges live alongside it on the Today queue rather
than as standalone surfaces — web has no equivalent home for them.
`sync-enforcer` should treat this as a deliberate carve-out, mirroring
the `move-meal` and `recipe go-public` carve-outs already on file.

### Tests

`apps/mobile/tests/unit/onboardingNudgeQueue.test.tsx` (12 cases) pins:
priority order, cooldown filtering, cooldown elapsed → re-shows,
"Maybe later" writes timestamp without firing OS APIs or routing,
primary on permissions calls real HealthKit + Notifications APIs and
sets the permanent-removal flag, primary on import routes to
`/import-shared`, primary on recipes routes to `/(tabs)/library`,
permanent-removal survives a missing timestamp, corrupt timestamps
fail-open to "never dismissed".

## Activation hooks (audit 2026-04-30 follow-up)

The shrink left three audit-flagged leaks downstream. Resolved by the
five-fix activation pass — see
`docs/decisions/2026-04-30-activation-hooks-post-onboarding.md`:

1. `notifications-prompt` now routes to Today (not Discover).
2. `mobile-flow.tsx` seeds the library with curated defaults when
   `pickedRecipeSlugs` is empty (no more empty-library north-star
   block on day-1).
3. First-log toast on Today.
4. Post-onboarding push-permission explainer on first Today render
   (the recovery path for the permissions step we removed from the
   linear flow).
5. NorthStar why-line so the suggestion stops reading as black-box.
