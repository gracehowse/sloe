-- ENG-955 — gentle, opt-in weigh-in reminder push (anti-nag).
--
-- Adds the per-user dedupe stamp the cron writes after a successful weigh-in
-- reminder delivery on either rail (Expo / Web Push). Mirrors
-- `profiles.last_weekly_recap_push_sent_at` exactly in shape + role: the
-- `/api/push/weigh-in-reminder` cron skips any row stamped inside the 6-day
-- dedupe window (see `src/lib/push/weighInReminder.ts`
-- `WEIGH_IN_REMINDER_DEDUPE_WINDOW_MS`), so an hourly cron never double-fires
-- inside the user's chosen-hour window and a tz shift can't re-trigger.
--
-- The opt-in toggle + cadence (weekday + hour) live inside the existing
-- freeform `profiles.notification_prefs` JSONB under the `weighInReminder`
-- key — no new column is needed for the preference itself. This migration
-- adds ONLY the delivery dedupe timestamp.
--
-- Nullable, no default: a null stamp means "never sent" → eligible on the
-- first qualifying cron tick. Preserves the existing profile shape for every
-- current row.
alter table public.profiles
  add column if not exists last_weigh_in_reminder_sent_at timestamptz;

comment on column public.profiles.last_weigh_in_reminder_sent_at is
  'ENG-955 — last successful weigh-in reminder push delivery (UTC). Written by the /api/push/weigh-in-reminder cron after an Expo/Web Push success; used for the 6-day dedupe window. Null = never sent.';
