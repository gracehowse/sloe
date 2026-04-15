-- Allow users to customise which macro widgets they see on the Today screen.
-- Default is ["protein", "carbs", "fat"]. Users can add "fiber", "water", etc.
alter table public.profiles
  add column if not exists tracked_macros jsonb not null default '["protein","carbs","fat"]'::jsonb;
