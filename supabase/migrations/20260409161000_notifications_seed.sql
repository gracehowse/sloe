-- One-time seed notification flag (prevents spamming the welcome message).

alter table public.profiles
add column if not exists notifications_seeded boolean not null default false;

