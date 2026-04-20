-- Weekly recap push — tz-aware fan-out (T12, 2026-04-20).
--
-- Add an IANA timezone column to `profiles` so the server cron can
-- fire the weekly recap at the user's local 18:00 instead of a fixed
-- 18:00 UTC wall-clock. Without this column every user receives the
-- push at the same UTC instant, which lands at 02:00 local for
-- users in UTC+8..+10. See
-- docs/decisions/2026-04-20-weekly-recap-tz-aware-fanout.md.
--
-- Column is nullable by design: existing users have no populated
-- value until they open the app post-deploy. The route treats a null
-- value as "UTC" for fan-out scheduling — this preserves the
-- pre-migration behaviour (fire at 18:00 UTC) until clients have
-- written a real value. There is no default here: defaults would
-- mask whether we've heard from the client, and a wrong default
-- (UTC for everyone) would fire pushes at bad-hour local times for
-- months without our knowing.
--
-- Values are IANA Olson zone names as returned by
-- `Intl.DateTimeFormat().resolvedOptions().timeZone` — e.g.
-- `Europe/London`, `America/Cayman`, `Asia/Singapore`. No
-- normalisation is applied; deprecated aliases are acceptable
-- (Node's Intl conversion handles them transparently). DST
-- transitions are handled at push-time by the route using the IANA
-- zone, so a single stored value is correct year-round.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tz_iana text NULL;

COMMENT ON COLUMN public.profiles.tz_iana IS
  'IANA Olson timezone name for this profile (e.g. "Europe/London"). '
  'Written by web + mobile clients on auth-state-change and app '
  'foreground. Read by the weekly recap push cron to fan out at the '
  'user''s local 18:00 instead of 18:00 UTC. Null means client has '
  'not yet reported — route treats null as "UTC" so pre-migration '
  'behaviour is preserved.';
