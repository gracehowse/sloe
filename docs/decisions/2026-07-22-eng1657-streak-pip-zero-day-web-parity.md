# Web streak pip — always show at 0-day (mobile parity, ENG-1657)

**Date:** 2026-07-22
**Decider:** 2026-07-22 full-backlog decision pack (`docs/decisions/2026-07-22-full-backlog-decision-pack.md`)
**Status:** Implemented, flag-gated, default-ON (flipped 2026-07-24 — see Update below)

## Decision

**Match mobile.** Web shows the Today header `StreakPip` at 0-day streak
(calm-streak posture) behind `streak_pip_zero_day_web_v1`:

- **Flag ON** — `TodayDateHeader` mounts the pip for any non-negative streak
  count on today's day view (same as mobile's "we do NOT hide a 0-day
  streak" posture in `apps/mobile/components/today/StreakPip.tsx`).
- **Flag OFF** — legacy web gate unchanged: pip mounts only when
  `streakDays >= 2` (the premium-bar audit DC8 default that predates this
  ticket).

The `StreakPip` primitive itself always renders when mounted; visibility
is host-controlled in `today-date-header.tsx`.

## Context

After ENG-1651 collapsed `premium-sweep-v2-p0-t26`, web hid the pip at
0-day while mobile explicitly kept it visible so first-time users see
what the surface tracks. The 2026-07-22 decision pack resolved the open
product question: web should match mobile.

## Rollout

Default-ON since 2026-07-24 (see Update above) — no PostHog row was ever
created, so cold resolution is `REDESIGN_DEFAULT_ON`'s unconditional `true`
via the plain `isFeatureEnabled` call site (unchanged from this PR). Nothing
further to ramp. Matching the convention used for every other
`REDESIGN_DEFAULT_ON` flag in this codebase (`smart_suggestions_v1`,
`meal_share_links_v1`, `ui_anatomy_owners_v1`), the "kill switch" here is a
follow-up commit reverting the registry move — not a live PostHog toggle;
none of these call sites are wired through `isFeatureDisabled`.

See `docs/operations/posthog-rollout.md` → `streak_pip_zero_day_web_v1`.

## Files

| File | Change |
| --- | --- |
| `src/app/components/suppr/streak-pip.tsx` | Docstring aligned with mobile; component always renders when mounted |
| `src/app/components/suppr/today-date-header.tsx` | Flag-gated `showStreakPip` mount rule |
| `src/lib/analytics/track.ts` | `streak_pip_zero_day_web_v1` in `REDESIGN_DEFAULT_ON` (moved from `KNOWN_DEFAULT_OFF_FLAGS` 2026-07-24) |
| `apps/mobile/lib/analytics.ts` | Registry parity only (web-only flag) |

## Update — 2026-07-24: flag flipped to default-ON

A separate worktree independently implemented ENG-1657 the same day this PR
was authored, as an unconditional, unflagged always-show change (removing
both `streak-pip.tsx`'s 0-day suppression and `today-date-header.tsx`'s
`streakDays >= 2` gate entirely, no flag). That commit never merged — this
flag-gated PR (#1070) landed on `main` first (2026-07-23), and the
unflagged worktree's branch was rebased into a conflict against it.

**Reconciliation (Grace's call):** keep this PR's flag-gated implementation
— don't ship an unflagged visual change — but flip `streak_pip_zero_day_web_v1`
from `KNOWN_DEFAULT_OFF_FLAGS` to `REDESIGN_DEFAULT_ON`. This produces the
exact same visible behaviour as the unflagged patch (the flag-ON branch was
already `streakDays >= 0`) while keeping the PostHog row as an emergency
kill switch, per the non-negotiable visual-change-flag rule. The unflagged
worktree commit was discarded.

No code changes to `streak-pip.tsx` or `today-date-header.tsx` were needed
for the flip — only the flag's registry membership moved. See the updated
`Rollout` section below and `docs/operations/posthog-rollout.md` →
`streak_pip_zero_day_web_v1`.
