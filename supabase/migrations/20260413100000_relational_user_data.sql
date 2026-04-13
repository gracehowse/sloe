-- Phase 1: Migrate meal_plans, nutrition_journals, and shopping_lists
-- from single-row JSONB blobs to per-row relational tables.
-- Old tables are renamed *_legacy for 30-day rollback safety.

-- ═══════════════════════════════════════════════════════════════════
-- 1. MEAL PLAN DAYS + MEALS
-- ═══════════════════════════════════════════════════════════════════

create table if not exists meal_plan_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slot_id     text not null default 'default',
  day         smallint not null check (day between 1 and 7),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slot_id, day)
);

create table if not exists meal_plan_meals (
  id                  uuid primary key default gen_random_uuid(),
  plan_day_id         uuid not null references meal_plan_days(id) on delete cascade,
  slot_index          smallint not null check (slot_index between 0 and 15),
  name                text not null default '',
  recipe_title        text not null default '',
  recipe_id           text,
  calories            smallint not null default 0,
  protein             real not null default 0,
  carbs               real not null default 0,
  fat                 real not null default 0,
  portion_multiplier  real not null default 1,
  is_placeholder      boolean not null default false,
  unique (plan_day_id, slot_index)
);

alter table meal_plan_days enable row level security;
alter table meal_plan_meals enable row level security;

create policy "Own plan days" on meal_plan_days for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own plan meals" on meal_plan_meals for all
  using (exists (select 1 from meal_plan_days d where d.id = plan_day_id and d.user_id = auth.uid()))
  with check (exists (select 1 from meal_plan_days d where d.id = plan_day_id and d.user_id = auth.uid()));

create index idx_mpd_user on meal_plan_days(user_id);
create index idx_mpm_day on meal_plan_meals(plan_day_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. NUTRITION JOURNAL ENTRIES (one row per logged meal)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists nutrition_entries (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  date_key            date not null,
  name                text not null default '',
  recipe_title        text not null default '',
  time_label          text not null default '',
  calories            smallint not null default 0,
  protein             real not null default 0,
  carbs               real not null default 0,
  fat                 real not null default 0,
  fiber_g             real,
  water_ml            real,
  portion_multiplier  real default 1,
  created_at          timestamptz not null default now()
);

alter table nutrition_entries enable row level security;

create policy "Own nutrition entries" on nutrition_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_ne_user_date on nutrition_entries(user_id, date_key);

-- ═══════════════════════════════════════════════════════════════════
-- 3. SHOPPING LIST ITEMS (one row per item)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists shopping_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default '',
  amount      text not null default '',
  unit        text not null default '',
  category    text not null default 'Other',
  checked     boolean not null default false,
  source      text not null default '',
  created_at  timestamptz not null default now()
);

alter table shopping_items enable row level security;

create policy "Own shopping items" on shopping_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_si_user on shopping_items(user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 4. DATA MIGRATION: Copy existing JSONB blobs into new tables
-- ═══════════════════════════════════════════════════════════════════

-- 4a. Meal plans
do $$
declare
  r record; day_rec jsonb; meal_rec jsonb;
  day_num smallint; slot_idx smallint; new_day_id uuid;
begin
  for r in select user_id, plan from meal_plans where plan is not null loop
    if jsonb_typeof(r.plan) <> 'array' then continue; end if;
    for day_rec in select jsonb_array_elements(r.plan) loop
      day_num := (day_rec->>'day')::smallint;
      if day_num is null then continue; end if;
      insert into meal_plan_days (user_id, slot_id, day) values (r.user_id, 'default', day_num)
        on conflict (user_id, slot_id, day) do nothing returning id into new_day_id;
      if new_day_id is null then
        select id into new_day_id from meal_plan_days where user_id = r.user_id and slot_id = 'default' and day = day_num;
      end if;
      if day_rec->'meals' is null or jsonb_typeof(day_rec->'meals') <> 'array' then continue; end if;
      slot_idx := 0;
      for meal_rec in select jsonb_array_elements(day_rec->'meals') loop
        insert into meal_plan_meals (plan_day_id, slot_index, name, recipe_title, calories, protein, carbs, fat, portion_multiplier, is_placeholder)
        values (new_day_id, slot_idx, coalesce(meal_rec->>'name',''), coalesce(meal_rec->>'recipeTitle',''),
          coalesce((meal_rec->>'calories')::smallint,0), coalesce((meal_rec->>'protein')::real,0),
          coalesce((meal_rec->>'carbs')::real,0), coalesce((meal_rec->>'fat')::real,0),
          coalesce((meal_rec->>'portionMultiplier')::real,1), coalesce((meal_rec->>'isPlaceholder')::boolean,false))
        on conflict (plan_day_id, slot_index) do nothing;
        slot_idx := slot_idx + 1;
      end loop;
    end loop;
  end loop;
end $$;

-- 4b. Nutrition journals
do $$
declare
  r record; day_key text; meals_arr jsonb; meal_rec jsonb;
begin
  for r in select user_id, by_day from nutrition_journals where by_day is not null loop
    if jsonb_typeof(r.by_day) <> 'object' then continue; end if;
    for day_key, meals_arr in select * from jsonb_each(r.by_day) loop
      if jsonb_typeof(meals_arr) <> 'array' then continue; end if;
      for meal_rec in select jsonb_array_elements(meals_arr) loop
        insert into nutrition_entries (user_id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier)
        values (r.user_id, day_key::date, coalesce(meal_rec->>'name',''), coalesce(meal_rec->>'recipeTitle',''),
          coalesce(meal_rec->>'time',''), coalesce((meal_rec->>'calories')::smallint,0),
          coalesce((meal_rec->>'protein')::real,0), coalesce((meal_rec->>'carbs')::real,0),
          coalesce((meal_rec->>'fat')::real,0), (meal_rec->>'fiberG')::real,
          (meal_rec->>'waterMl')::real, coalesce((meal_rec->>'portionMultiplier')::real,1))
        on conflict do nothing;
      end loop;
    end loop;
  end loop;
end $$;

-- 4c. Shopping lists
do $$
declare
  r record; item_rec jsonb;
begin
  for r in select user_id, items from shopping_lists where items is not null loop
    if jsonb_typeof(r.items) <> 'array' then continue; end if;
    for item_rec in select jsonb_array_elements(r.items) loop
      insert into shopping_items (user_id, name, amount, unit, category, checked, source)
      values (r.user_id, coalesce(item_rec->>'name',''), coalesce(item_rec->>'amount',''),
        coalesce(item_rec->>'unit',''), coalesce(item_rec->>'category','Other'),
        coalesce((item_rec->>'checked')::boolean,false), coalesce(item_rec->>'from',''));
    end loop;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. RENAME OLD TABLES (keep for rollback safety)
-- ═══════════════════════════════════════════════════════════════════

alter table if exists meal_plans rename to meal_plans_legacy;
alter table if exists nutrition_journals rename to nutrition_journals_legacy;
alter table if exists shopping_lists rename to shopping_lists_legacy;
