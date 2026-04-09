-- Unified food database + barcode correction loop

-- Canonical foods
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  display_name text not null,
  brand text,
  is_verified boolean not null default false
);

alter table public.foods enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='foods' and policyname='foods_select_public'
  ) then
    create policy "foods_select_public"
    on public.foods for select
    using (true);
  end if;
end $$;

-- Food source records (USDA fdcId, OFF barcode/product id, etc.)
create table if not exists public.food_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  food_id uuid not null references public.foods(id) on delete cascade,
  source text not null check (source in ('USDA','OpenFoodFacts','Community','FatSecret','Nutritionix')),
  external_id text not null,
  source_url text,
  confidence numeric,
  unique (source, external_id)
);

create index if not exists food_sources_food_id_idx on public.food_sources(food_id);

alter table public.food_sources enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='food_sources' and policyname='food_sources_select_public'
  ) then
    create policy "food_sources_select_public"
    on public.food_sources for select
    using (true);
  end if;
end $$;

-- Barcode → canonical food mapping (persist “find a better match”)
create table if not exists public.barcode_mappings (
  barcode text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  food_id uuid not null references public.foods(id) on delete cascade,
  source text not null check (source in ('OpenFoodFacts','Community')),
  external_id text,
  display_name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  is_verified boolean not null default false
);

create index if not exists barcode_mappings_food_id_idx on public.barcode_mappings(food_id);

alter table public.barcode_mappings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_select_public'
  ) then
    create policy "barcode_mappings_select_public"
    on public.barcode_mappings for select
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_write_own'
  ) then
    create policy "barcode_mappings_write_own"
    on public.barcode_mappings for insert
    with check (auth.uid() = created_by);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_update_own'
  ) then
    create policy "barcode_mappings_update_own"
    on public.barcode_mappings for update
    using (auth.uid() = created_by)
    with check (auth.uid() = created_by);
  end if;
end $$;

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists barcode_mappings_set_updated_at on public.barcode_mappings;
create trigger barcode_mappings_set_updated_at
before update on public.barcode_mappings
for each row execute function public.set_updated_at();

-- Reporting / correction queue (lightweight MVP)
create table if not exists public.food_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('barcode_wrong_match','nutrition_incorrect','duplicate','missing_food')),
  source text,
  external_id text,
  barcode text,
  message text,
  status text not null default 'open' check (status in ('open','triaged','fixed','ignored'))
);

alter table public.food_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='food_reports' and policyname='food_reports_insert_own'
  ) then
    create policy "food_reports_insert_own"
    on public.food_reports for insert
    with check (auth.uid() = reporter_id);
  end if;
end $$;

