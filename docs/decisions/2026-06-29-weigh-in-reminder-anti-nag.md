---
date: 2026-06-29
area: push/notifications
status: Resolved
owner: Grace (ENG-955, category-leading growth)
linear: ENG-955 (parent ENG-1220)
---

# Weigh-in reminder push — gentle, opt-in, anti-nag (never a streak threat)

## Decision

Ship a **gentle, opt-in** weekly weigh-in reminder push, tied to a user-set
weekly cadence (weekday + hour). It is a calm nudge, not a nag — and
explicitly **never** a streak/badge/threat.

Three anti-nag guarantees, all enforced in the headless core
(`src/lib/push/weighInReminder.ts`) so they can't drift between the cron and
the UI:

1. **Opt-in only.** Nobody gets a reminder unless they toggled it ON in
   Settings. The whole feature (cron behaviour + the toggle UI) is gated
   behind the default-OFF `weigh_in_reminder_v1` flag, so nothing ships until
   the ramp.
2. **Skip if already logged this period.** If the user already weighed in
   during the current 7-day period, the reminder is suppressed — a nudge never
   lands on top of a fresh weigh-in.
3. **Warm, trend-framed copy.** Title `"Weekly weigh-in"`, body
   `"Ready for a quick weigh-in? Mornings give the steadiest trend."` No
   "don't lose your streak", no badge, no exclamation marks, no weight-loss
   claim. Pinned by unit tests.

Cadence is user-chosen (weekday + hour, defaulting to Monday 08:00 local) and
fires in the user's local timezone, DST-correct via the IANA zone — the same
approach as the weekly-recap tz-aware fan-out
(`2026-04-20-weekly-recap-tz-aware-fanout.md`). The cron therefore runs
**hourly** (`0 * * * *`).

## Why

Reminder pushes are the standard retention lever, but the category's worst
habit is the streak-threat ("Don't break your 12-day streak!") — exactly the
toxic gamification Suppr's voice forbids. A weigh-in reminder is only worth
shipping if it's the *kind* a body-neutral, adult product would send: opt-in,
skippable, and silent when there's nothing to nudge about. The "skip if
already logged" rule is the difference between a helpful prompt and a nag.

Weighing in the morning (fasted, pre-meal) gives the steadiest trend line for
adaptive-TDEE learning, so the copy gently leans that way as guidance — never
as a rule.

## Implementation

- **Cron:** `app/api/push/weigh-in-reminder/route.ts` — mirrors the
  weekly-recap delivery rail (X-Cron-Secret auth, service-role select, Expo +
  Web Push dual-rail fan-out, DeviceNotRegistered / dead-endpoint cleanup,
  5000-row cap, structured `{ at, attempted, succeeded, ... }` log).
- **Core:** `src/lib/push/weighInReminder.ts` — opt-in + tz window + 6-day
  dedupe + already-logged-this-period gates, plus the warm copy assembler.
  Pure, shared web/mobile, headless-tested.
- **Dedupe column:** `profiles.last_weigh_in_reminder_sent_at` (migration
  `20260702120500_profiles_weigh_in_reminder_dedupe.sql`). The opt-in +
  cadence live in the existing freeform `notification_prefs` JSONB under
  `weighInReminder` — no new column for the pref itself.
- **Settings UI:** mobile `WeighInReminderRow` + `WeighInReminderPicker`
  (Reminders card); web `WeighInReminderControl` (Notifications card). Both
  gated by `weigh_in_reminder_v1`; both write `notification_prefs.weighInReminder`.
- **Analytics:** `weigh_in_reminder_enabled_toggled` (Settings),
  `weigh_in_reminder_push_attempted` (cron outcomes).

## Open follow-ups

- The Settings toggle UI still needs SIM (mobile) + web visual verification
  with `weigh_in_reminder_v1` forced ON before the flag ramps — flag-off ships
  no visual change, so this lands as a SIM follow-on, not a blocker.
- At ramp scale the opt-in filter could move from an in-memory gate to a
  generated boolean column + `.eq` filter; for the beta opt-in cohort the
  in-memory gate over a non-null `notification_prefs` is correct and cheap.
