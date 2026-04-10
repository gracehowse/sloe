-- Generic in-app notifications + user prefs (sync across devices).

alter table public.profiles
add column if not exists notification_prefs jsonb not null default jsonb_build_object(
  'newRecipes', true,
  'mealReminders', false,
  'weeklyReport', true,
  'creatorUpdates', true
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists app_notifications_user_created_idx
  on public.app_notifications(user_id, created_at desc);

create index if not exists app_notifications_user_unread_idx
  on public.app_notifications(user_id, read_at)
  where read_at is null;

alter table public.app_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications'
      and policyname = 'app_notifications_select_own'
  ) then
    create policy "app_notifications_select_own"
    on public.app_notifications for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications'
      and policyname = 'app_notifications_insert_own'
  ) then
    create policy "app_notifications_insert_own"
    on public.app_notifications for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications'
      and policyname = 'app_notifications_update_own'
  ) then
    create policy "app_notifications_update_own"
    on public.app_notifications for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications'
      and policyname = 'app_notifications_delete_own'
  ) then
    create policy "app_notifications_delete_own"
    on public.app_notifications for delete
    using (auth.uid() = user_id);
  end if;
end $$;

