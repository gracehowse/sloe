-- TestFlight build 7 — APNs push token registration
-- (`AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`).
--
-- The mobile client now calls `getExpoPushTokenAsync` once OS permission
-- is granted and writes the resulting `ExponentPushToken[...]` string to
-- `profiles.expo_push_token`. Any future server-side push delivery path
-- (currently the weekly recap is a local notification — see
-- `apps/mobile/lib/weeklyRecapPush.ts`) will read this column and POST to
-- Expo's push API.
--
-- Idempotent so manual reruns and partial-state envs do not error.

alter table public.profiles
  add column if not exists expo_push_token text;

comment on column public.profiles.expo_push_token is
  'Expo push token (ExponentPushToken[...]) for the user''s most recent install. Written by mobile after OS permission grant; rotated by the focus-effect refresh in apps/mobile/app/(tabs)/index.tsx. Nullable: web users and not-yet-prompted mobile users have no token.';

-- Tell PostgREST to refresh its schema cache so REST clients see the new
-- column without a server restart.
notify pgrst, 'reload schema';
