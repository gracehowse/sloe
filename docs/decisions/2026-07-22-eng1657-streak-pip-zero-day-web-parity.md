# Web streak pip — always show at 0-day (mobile parity, ENG-1657)

**Date:** 2026-07-22
**Decider:** 2026-07-22 full-backlog decision pack (`docs/decisions/2026-07-22-full-backlog-decision-pack.md`)
**Status:** Implemented, flag-gated, default-OFF

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

Default-OFF per the visual-change flag rule. Create the PostHog row, validate
flag-on pixels on web (`web-drive`) with a 0-day / 1-day fresh-user state,
then ramp internal → 100%. After two weeks at 100% with no regression,
collapse the gate and remove the legacy ≥2-day branch.

See `docs/operations/posthog-rollout.md` → `streak_pip_zero_day_web_v1`.

## Files

| File | Change |
| --- | --- |
| `src/app/components/suppr/streak-pip.tsx` | Docstring aligned with mobile; component always renders when mounted |
| `src/app/components/suppr/today-date-header.tsx` | Flag-gated `showStreakPip` mount rule |
| `src/lib/analytics/track.ts` | `streak_pip_zero_day_web_v1` in `KNOWN_DEFAULT_OFF_FLAGS` |
| `apps/mobile/lib/analytics.ts` | Registry parity only (web-only flag) |
