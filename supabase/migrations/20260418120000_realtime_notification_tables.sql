-- Broadcast notification table changes to Supabase Realtime (mobile inbox subscriptions).
-- Guard with to_regclass: some prod DBs recorded older migrations as applied without
-- actually having every table (drift). Skipping ADD TABLE avoids hard failure; run
-- supabase/scripts/ensure_creator_publish_notifications.sql (or migration 20260409140000)
-- on prod first if you need this table in Realtime.
do $$
begin
  if to_regclass('public.app_notifications') is not null
     and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;

  if to_regclass('public.creator_publish_notifications') is not null
     and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'creator_publish_notifications'
  ) then
    alter publication supabase_realtime add table public.creator_publish_notifications;
  end if;
end $$;
