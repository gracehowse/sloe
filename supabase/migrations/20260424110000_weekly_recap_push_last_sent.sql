-- Server-side weekly recap push fan-out (TestFlight build 10 fix C —
-- follow-up to the 2026-04-18 `expo_push_token` shipment; references
-- `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`).
--
-- Adds the dedupe column the new `/api/push/weekly-recap` route reads
-- before fanning out and writes after a successful ticket. Without this
-- column a re-triggered cron would double-push the same user in the
-- same week.
--
-- Column:
--   - `last_weekly_recap_push_sent_at` (timestamptz, nullable). Stamped
--     by the route after a successful Expo ticket. The route skips rows
--     whose stamp is within the last 6 days. Nullable: users who have
--     never received a server-side push have no stamp.
--
-- Idempotent so manual reruns and partial-state envs do not error.

alter table public.profiles
  add column if not exists last_weekly_recap_push_sent_at timestamptz;

comment on column public.profiles.last_weekly_recap_push_sent_at is
  'Timestamp of the most recent successful server-side weekly recap push. Written by app/api/push/weekly-recap/route.ts. Used to dedupe across cron runs within a 6-day window. Nullable: never-sent users have no stamp.';

-- Tell PostgREST to refresh its schema cache so REST clients see the new
-- column without a server restart.
notify pgrst, 'reload schema';
