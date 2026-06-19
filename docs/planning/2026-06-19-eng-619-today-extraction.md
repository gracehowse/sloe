# ENG-619 Today extraction checkpoint — 2026-06-19

ENG-619 starts the mobile Today god-file reduction by making the tab route a
thin composition entry point and moving the legacy implementation behind a
private Today module.

## Landed in this checkpoint

- `apps/mobile/app/(tabs)/index.tsx` is now a 3-line route shell that exports
  the Today composition root.
- The existing Today implementation moved to
  `apps/mobile/app/(tabs)/_today/TodayScreen.tsx` so follow-up extraction can
  happen without growing the route file.
- `apps/mobile/app/(tabs)/_today/useToday.ts` owns the first route/session/safe
  area composition slice and returns a typed view model consumed by the screen.

## Follow-up boundary

The behavioural state remains in `TodayScreen` for this checkpoint to avoid a
high-risk, all-at-once migration of meal persistence, health sync, deep links,
win moments, and activity/extras state. The next ENG-619 slice should move one
concern at a time into bounded `_today` hooks, beginning with persistence-free
read state before write paths.

## Parity note

This is mobile-only structure work. It does not change visible Today UX and does
not alter web `src/app/components/NutritionTracker.tsx`; web still needs its own
matching god-file extraction under the architecture-enabler backlog.
