---
date: 2026-04-20
area: push/notifications
status: Resolved
owner: Grace (T12, decided 2026-04-20)
---

# Weekly recap push — fire at 6pm local time, not 18:00 UTC

## Decision

The weekly recap push now fires at 18:00 in the user's local time
instead of 18:00 UTC for everyone.

- The cron runs hourly instead of once a week.
- Each invocation filters users to those whose local time is 18:00
  on their end-of-week day (Sunday for Monday-start users, Saturday
  for Sunday-start users).
- Daylight saving is handled automatically because the filter uses
  the stored IANA zone name (e.g. `Europe/London`), not a fixed
  UTC offset.

## Why

Before this change the push landed at 19:00 BST for UK users (fine)
but at 02:00 AWST for Perth and 06:00 NZST for New Zealand. A
middle-of-night push is the kind of thing that makes people disable
notifications forever, and permission revocations are permanent. As
long as the product has only UK/US testers the UTC-wall-clock
behaviour looks fine; it only breaks when someone in Asia-Pacific
joins TestFlight or when we open to a non-UK audience.

Journey-architect (2026-04-20 audit) classified this as a WARNING,
not a ship-blocker, because the current tester cohort is UK-heavy.
Grace chose to ship the correct version now rather than carry the
warning — cheaper than retrofitting after the first complaint and
removes a class of customer-trust bug from the roadmap.

## Design

**Storage.** New column `profiles.tz_iana text NULL`. IANA Olson
zone name as returned by `Intl.DateTimeFormat().resolvedOptions().timeZone`
— e.g. `Europe/London`, `America/Cayman`, `Asia/Singapore`. Nullable
by design: pre-migration users carry null until their client app
writes a real value, and the route treats null as UTC so their
behaviour is unchanged until the write lands.

**Write path.** Mobile and web clients write the current IANA zone
whenever we have a user id:
- Initial session restore.
- Auth-state-change event (sign-in, sign-out, token refresh).
- Mobile only: app-foreground event (catches travel and DST).

All writes go through the shared helper
[`src/lib/profile/tzSync.ts`](../../src/lib/profile/tzSync.ts). Fire
and forget — errors are logged at warn and never block auth.

**Read path.** The server cron route
[`app/api/push/weekly-recap/route.ts`](../../app/api/push/weekly-recap/route.ts)
selects `tz_iana` alongside the existing columns and runs each
eligible row through the pure filter
[`src/lib/push/weeklyRecapTzFilter.ts`](../../src/lib/push/weeklyRecapTzFilter.ts).
Users who pass the filter AND the 6-day dedupe continue down the
fan-out; everyone else is skipped silently.

**Cron.** `vercel.json` now has a single hourly cron
(`0 * * * *` → `/api/push/weekly-recap`) instead of the two fixed
weekly crons. The cohort split (`weekStartDay=monday|sunday`) moved
from the cron URL to the in-memory tz filter.

**Dedupe.** The existing 6-day `last_weekly_recap_push_sent_at`
window is the backstop that prevents the hourly cron from double-
firing — once the route sends a user this week, the 6-day gate
filters them out for the next 24 of the cron's hourly invocations.

## Fallback behaviour

A null or unrecognised `tz_iana` value is treated as UTC. This means:

- New users who haven't yet opened the app after the migration
  lands get the push at 18:00 UTC on their end-of-week day —
  the old pre-migration behaviour, not worse.
- If a user's stored zone becomes invalid (IANA database dropped
  an alias — very rare), they still get a push at 18:00 UTC rather
  than being silently dropped.

Both fallbacks prefer "push at a reasonable-for-UK time" over
"skip the user entirely" because the feature's whole value is in
the weekly touchpoint.

## Tests

- [`tests/unit/weeklyRecapTzFilter.test.ts`](../../tests/unit/weeklyRecapTzFilter.test.ts)
  — 14 tests: exact-hour hits, off-hour misses, DST transitions,
  null/empty/unrecognised fallback.
- [`tests/unit/tzSync.test.ts`](../../tests/unit/tzSync.test.ts)
  — 5 tests: correct DB call shape, error swallowing, exception
  swallowing.
- [`tests/unit/weeklyRecapPushRoute.test.ts`](../../tests/unit/weeklyRecapPushRoute.test.ts)
  — existing route tests updated: the tz filter is mocked to
  always-true so the fan-out / dedupe / bookkeeping assertions
  continue to hold; the removed-cohort-URL test was replaced with
  a positive assertion that the route no longer applies the DB
  `week_start_day` filter.

## Deploy sequence

1. Commit + push — lands migration file, route code, client writes,
   tests, docs.
2. Grace applies the migration with `supabase db push --linked`
   (never MCP `apply_migration` — CLAUDE.md non-negotiable).
3. Web + mobile next-deploy writes populate `tz_iana` for active
   users on next session restore.
4. First hourly cron after the migration lands starts fan-out at
   the user's local 18:00. Users with null `tz_iana` fall back to
   18:00 UTC until step 3 populates them.

## Gotchas worth remembering

- Node's `Intl.DateTimeFormat` handles DST via the IANA database
  that ships with the runtime. If Node is updated out-of-band and
  the IANA db is stale, a just-transitioned zone could drift by
  an hour for one firing. Fix is to update Node on Vercel — no
  app change.
- React Native's Hermes Intl is slightly older than Node Intl;
  both return IANA zone names, but some edge-case aliases may
  differ. We store whatever the client reports — Node's Intl is
  tolerant of legacy aliases when reading.
- A user who signs out then signs back in as a different user on
  the same device: the new user's `tz_iana` gets written on the
  sign-in event. Never goes stale.
