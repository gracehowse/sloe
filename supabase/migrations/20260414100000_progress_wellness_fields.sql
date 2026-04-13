-- Weight history, steps, body fat for Progress / Apple Health–style dashboards
alter table public.profiles
  add column if not exists weight_kg_by_day jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists steps_by_day jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists daily_steps_goal int not null default 10000;

alter table public.profiles
  add column if not exists body_fat_pct numeric;

comment on column public.profiles.weight_kg_by_day is 'Map YYYY-MM-DD -> weight in kg (logged weigh-ins)';
comment on column public.profiles.steps_by_day is 'Map YYYY-MM-DD -> step count';
comment on column public.profiles.daily_steps_goal is 'Daily steps target (e.g. 10000)';
comment on column public.profiles.body_fat_pct is 'Latest body fat % (optional)';
