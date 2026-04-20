---
date: 2026-04-20
area: push/notifications
status: Resolved
owner: product-lead (T11, decided 2026-04-20)
---

# Mobile-local weekly-recap push — killed

## Decision

Remove mobile-local scheduling of the weekly-recap push. Server cron
(`app/api/push/weekly-recap/route.ts` → Expo → APNs) is the sole
delivery path. Installs without a synced `profiles.expo_push_token`
receive no weekly push.

## Why

The mobile-local fallback scheduled an `expo-notifications` `WEEKLY`
trigger at 18:00 device-local on the end-of-week day with a
hardcoded generic body: *"Tap to see your weekly recap — avg
calories, protein, streak, and weight trend."*

That body is content-free. It fires for users whose device didn't
have a synced Expo push token (a small minority — permission denied,
simulator, pre-upgrade installs). The server cron path, which fires
a per-user content-specific body for synced installs, is the real
product.

We had three options:

- **(A) Keep generic fallback as-is.** Pragmatic; violates the
  stated "generic push = worse than no push" principle the team
  wrote into [TODO.md](../../TODO.md#hard-deadlines). One inconsistent
  voice across installs degrades the channel for everyone.
- **(B) Promote to a content-rich mobile-local version.** 1–2 days
  of eng. Ships a second-class recap (no cascade suggestion — the
  cascade needs server data). Institutionalises a split codepath.
- **(C) Kill mobile-local entirely.** Simplest. Respects the stated
  principle. Unsynced installs get nothing, which is acceptable —
  "unsynced" already means we can't reliably contact them. The fix
  is token-sync coverage (TODO P0-1), not a worse push.

Product-lead picked **(C)**. The bar for a weekly push is *"this was
worth the interrupt."* A generic fallback fails that bar on its own
terms.

## What changed

- `apps/mobile/lib/weeklyRecapPush.ts` — removed
  `scheduleWeeklyRecapPush`, `WeeklyRecapPushParams`, and
  `nextRecapDate`. Retained `cancelWeeklyRecapPush` (used for OS
  queue cleanup) and `handleWeeklyRecapNotificationResponse` (pure
  tap-handler, classifies server-cron pushes for analytics).
- `apps/mobile/app/_layout.tsx` — `HandleWeeklyRecapPushOpen` now
  calls `cancelWeeklyRecapPush()` once on mount so pre-kill installs
  with a stale `weekly-recap-v1` schedule evict it from the OS
  queue on first boot post-update. Idempotent; safe to run every
  launch.
- `apps/mobile/app/(tabs)/progress.tsx` — removed the scheduling
  `useEffect` and the `weekly_recap_push_sent` /
  `weekly_recap_push_scheduled` analytics emits. That emit carried a
  `weekKey` off-by-one bug (used `currentWeekKey` — the new week —
  instead of the previous completed week the recap described);
  removing the scheduler subsumes the fix (see TODO
  [Hard deadlines](../../TODO.md#hard-deadlines) 2026-05-18).
- `apps/mobile/app/(tabs)/more.tsx` — Settings toggle retained as a
  DB-only control over `profiles.weekly_recap_push_enabled`. The
  server cron reads that flag to decide fan-out. OFF still calls
  `cancelWeeklyRecapPush()` for immediate OS-queue responsiveness;
  ON is a DB-only toggle.
- Tests:
  - Deleted `apps/mobile/tests/unit/weeklyRecapPushSuppression.test.ts`
    (obsolete — tested local-scheduling suppression).
  - Updated `apps/mobile/tests/unit/progressSkeletonFirstPaint.test.tsx`
    mock to reflect the new module surface.

## What to track after Sunday 2026-04-27

- Server-cron fan-out: `weekly_recap_push_sent` / delivered / opened
  / CTR on the rich body.
- `profiles.expo_push_token` coverage at 17:59 UTC Sunday — the
  silent denominator.
- Unsubscribe / notification-disable rate in 24h after fire.
- Day-1 and day-3 return rate for pushed cohort vs unsynced cohort.

## Reconsider on

Token-sync coverage stalls below ~90% after TODO P0-1 ships AND the
unsynced cohort shows materially worse retention than synced. Even
then the answer is not a generic push — it's fixing sync or shipping
a *content-rich* mobile-local recap (option B), never (A).

## Cross-links

- TODO.md T11 (this work)
- TODO P0-1 (Expo push-token registration — upstream fix)
- TODO 2026-05-18 hard deadline (legacy analytics retirement — now resolved by kill)
- `app/api/push/weekly-recap/route.ts` (sole delivery path going forward)
- [docs/journeys/progress.md](../journeys/progress.md) (updated to remove mobile-local references)
