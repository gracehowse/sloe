-- Allow users to choose whether their week starts on Monday or Sunday.
-- Used by the Today screen DayStrip and Progress screen weekly view.
alter table public.profiles
  add column if not exists week_start_day text not null default 'monday'
    check (week_start_day in ('monday', 'sunday'));
