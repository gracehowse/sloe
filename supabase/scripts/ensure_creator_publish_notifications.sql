-- In-app notifications when a followed author/creator publishes a recipe.

create table if not exists public.creator_publish_notifications (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (user_id, recipe_id)
);

create index if not exists creator_publish_notifications_user_unread_idx
  on public.creator_publish_notifications(user_id, read_at)
  where read_at is null;

alter table public.creator_publish_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'creator_publish_notifications'
      and policyname = 'creator_publish_notifications_select_own'
  ) then
    create policy "creator_publish_notifications_select_own"
    on public.creator_publish_notifications for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'creator_publish_notifications'
      and policyname = 'creator_publish_notifications_update_own'
  ) then
    create policy "creator_publish_notifications_update_own"
    on public.creator_publish_notifications for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.notify_followers_on_recipe_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(new.published, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.published, false) then
    return new;
  end if;

  if new.author_id is not null then
    insert into public.creator_publish_notifications (user_id, recipe_id)
    select af.follower_id, new.id
    from public.author_follows af
    where af.author_id = new.author_id
    on conflict (user_id, recipe_id) do nothing;
  end if;

  if new.creator_id is not null then
    insert into public.creator_publish_notifications (user_id, recipe_id)
    select f.user_id, new.id
    from public.follows f
    where f.creator_id = new.creator_id
    on conflict (user_id, recipe_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_recipe_published_notify_followers on public.recipes;
create trigger on_recipe_published_notify_followers
after insert or update of published, author_id, creator_id on public.recipes
for each row execute function public.notify_followers_on_recipe_publish();
