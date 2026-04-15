-- Broadcast notification table changes to Supabase Realtime (mobile inbox subscriptions).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'creator_publish_notifications'
  ) then
    alter publication supabase_realtime add table public.creator_publish_notifications;
  end if;
end $$;
