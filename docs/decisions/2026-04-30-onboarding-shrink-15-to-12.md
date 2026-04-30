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

- Build the post-launch nudge queue: persistent banners on Today for
  Health permissions, Import, and Recipes seeding, with a per-banner
  cooldown (7 d / 7 d / 14 d) and priority ordering. The component
  files for each are already on disk.
- Update the customer-lens journey doc to reflect the new step count.
- Notion: update Roadmap ("Onboarding shrink") and add a Decisions row
  pointing at this file.
