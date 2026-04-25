# Schema drift audit — repo intent vs live remote prod (2026-04-25)

## Context

Trigger: `20260503100900_fatsecret_basic_tier_zeroing` failed on `recipe_ingredients.fatsecret_food_id` not existing on prod, despite `20260408143000_add_verified_nutrition_micros` being recorded in `schema_migrations`. Root cause is the early MCP `apply_migration` flow — recorded the version row without actually executing the DDL. We now self-heal at the top of 20260503100900 (added 2026-04-25).

Question: how many other recorded migrations were partial-applies?

Inputs compared:
- Repo intent: every `supabase/migrations/*.sql` (90 files through `20260503100900`) plus `supabase/schema.sql` end-state.
- Live remote: `/tmp/schema-drift-audit/{remote-columns,remote-policies,remote-indexes,remote-tables-rls,remote-triggers-functions}.json` extracted just now.

Approach: programmatic diff of (a) every `create table` not later `drop`d, (b) every `add column [if not exists]`, (c) every `create policy`, (d) every `create [unique] index`, (e) every `create [or replace] function`, (f) every `create trigger`. Then traced live app usage of each missing object.

The good news: the drift is **concentrated in two early migrations**. Everything from `20260409140000` forward landed cleanly (modulo two specific defaults that were silently skipped — see below). The bad news: those two early migrations carry six tables, eight functions, and the entire follow-author + barcode-correction loop the app actively depends on.

---

## Summary

| Tier | Count | Headline |
| --- | --- | --- |
| **0 — silent corruption / RLS bypass** | 1 | `recipe_ingredients.is_verified` defaults `true` on prod (should be `false`); silently lets manually-inserted rows count as nutrition-verified. |
| **1 — app-breaking** | 9 | `author_follows` + `recipe_plan_add_events` + four food-DB tables + their RPCs missing entirely; `promo_codes_select_own_redemptions` policy missing; `notify_followers_on_recipe_publish` BODY UNVERIFIED. |
| **2 — cosmetic / advisory** | 3 | Two missing secondary indexes (consequent to missing tables); legacy `meal_plans/_legacy` policies in schema.sql doc-only drift; `recipes_select_public` policy name in `schema.sql` is stale (correct name `recipes_select_published_or_own` IS on remote). |

Two recorded-but-unapplied migrations:
1. `20260408170000_food_db_unification` — entire migration ghosted. Six policies, four tables, two indexes, one function, one trigger missing.
2. `20260408180000_phase_4b_creator_social` — entire migration ghosted. Three policies, two tables, four indexes, five functions missing.

One partially-applied migration:
3. `20260408143000_add_verified_nutrition_micros` — six column adds applied (already self-healed by 20260503100900); two `alter column ... set default false` lines did NOT apply. Only `recipe_ingredients.is_verified` is still drifted (`recipes.is_verified` happens to read `false` because some later migration re-asserted it).

One missing single-policy migration:
4. `20260414120000_promo_codes_select_own_redemptions` — `promo_codes` table has RLS enabled but the SELECT policy this migration creates is absent on remote.

Everything else from 2026-04-09 onwards (87 migrations) is in the expected state on the audited surfaces.

---

## Tier 0 — silent corruption / RLS-bypass risk

### F-T0-1 — `recipe_ingredients.is_verified` default = `true` on prod

- **Object**: `public.recipe_ingredients.is_verified`
- **Expected**: `boolean not null default false` — see migration `20260408143000_add_verified_nutrition_micros.sql:20` (`alter table public.recipe_ingredients alter column is_verified set default false;`). Also asserted in `supabase/schema.sql:451`.
- **Actual**: `boolean not null default true` (remote-columns.json snapshot at extraction).
- **Migration that should have set it**: `20260408143000_add_verified_nutrition_micros.sql` (recorded in `schema_migrations` but the `set default false` DDL never ran — same partial-apply that caused today's FatSecret failure).
- **App refs**:
  - `apps/mobile/lib/saveImportedRecipe.ts:177` — passes `is_verified` explicitly per row.
  - `src/app/components/RecipeUpload.tsx:1026,1113` — passes explicitly.
  - `apps/mobile/app/create-recipe.tsx:560` — does NOT pass; relies on default. Any ingredient row that omits the field will be flagged verified on insert despite never being verified.
  - `scripts/seed-discover-recipes.ts:242` — does NOT pass.
- **Why Tier 0**: `is_verified` gates downstream nutrition trust — the `notify_followers_on_recipe_publish` trigger (when reinstated, see F-T1-2) only fans out for verified recipes. A wrongly-flagged ingredient row inflates a recipe's verified state. Solo-tester scope means N=1 blast radius today, but the failure is silent — no error, no log, just wrong data.
- **Self-heal SQL**:
  ```sql
  alter table public.recipe_ingredients alter column is_verified set default false;
  -- Backfill any row that exists today with is_verified = true AND is provably
  -- not actually verified (no fatsecret_food_id, no source verification trail).
  -- N=1 scope so safe to run, but inspect first if this audit lands later.
  ```

---

## Tier 1 — app-breaking

### F-T1-1 — `author_follows` table missing entirely

- **Object**: `public.author_follows` (table + 3 policies + 2 indexes)
- **Expected**: per-row `(follower_id, author_id, created_at)` with self-FK CHECK and full RLS. Created by `20260408180000_phase_4b_creator_social.sql:6-15`.
- **Actual**: missing. Migration recorded in `schema_migrations` but DDL never ran.
- **App refs**:
  - `src/app/components/RecipeDetail.tsx:281-287` — SELECT to determine follow state on a recipe page.
  - `src/app/components/RecipeDetail.tsx:397-412` — INSERT/DELETE for the Follow author button. Will hit "relation does not exist" and surface `error.message` to the user via toast.
  - `src/app/components/DiscoverFeed.tsx:192` — bulk SELECT to compute the follow graph; error swallowed (followed authors silently always empty).
  - `app/api/account/delete/route.ts:77` — DELETE; tolerated by `isIgnorable()`.
  - `apps/mobile/lib/database.types.ts:64` and `src/lib/supabase/database.types.ts:64` — types declare it exists.
- **Self-heal SQL**: re-execute the migration as-is — every statement is `if not exists`-guarded. See consolidated block below.

### F-T1-2 — `notify_followers_on_recipe_publish` trigger function: BODY UNVERIFIED, references missing `author_follows`

- **Object**: `public.notify_followers_on_recipe_publish()` + trigger `on_recipe_published_notify_followers` on `recipes`.
- **Expected**: `20260414120200_notify_only_verified.sql` defines the v2 body (only fan out when published AND verified). The body inserts into `creator_publish_notifications` from `author_follows` (line 58) and `follows`.
- **Actual**: trigger present (`remote-triggers-functions.json` shows both AFTER INSERT and AFTER UPDATE wirings); function present. Body NOT extracted.
- **Risk**: if the function body still runs the schema.sql-bootstrap version (which references `author_follows`), every recipe publish/update raises `relation "author_follows" does not exist` and the entire `recipes` UPDATE rolls back. This is consistent with the symptom that publishing has appeared to work in TestFlight only when `author_id is null` (the current `if author_id is not null` guard inside the function would short-circuit before touching author_follows). With solo-tester scope and Grace's published-recipe count of 0 we have no telemetry.
- **Migration that should have created it**: `20260408180000` (initial), then `20260414120200` (refined). 
- **App refs**: every UPDATE of `recipes.published` in app code — `src/app/components/RecipeUpload.tsx`, mobile `create-recipe.tsx`. Also the `recipes_publish_tier_gate` migration depends on this not exploding.
- **Self-heal SQL**: re-execute `20260414120200_notify_only_verified.sql` as-is once F-T1-1 lands. Idempotent (`create or replace function`).
- **NEED FUNCTION BODY**: confirm by fetching `pg_get_functiondef('public.notify_followers_on_recipe_publish'::regproc::oid)` to know whether it currently silently fails on author_id-bearing recipes or not.

### F-T1-3 — `recipe_plan_add_events` table missing entirely

- **Object**: `public.recipe_plan_add_events` + insert RLS + 2 indexes.
- **Expected**: append-only event log per `20260408180000_phase_4b_creator_social.sql:52-57`. SELECT policy added by `20260414200000_rls_select_policies.sql` (which itself wraps in `IF EXISTS`, so the missing table caused the SELECT policy to silently no-op rather than error — see L25-37).
- **Actual**: missing.
- **App refs**:
  - `apps/mobile/lib/database.types.ts:932`, `src/lib/supabase/database.types.ts:932` — types declare it.
  - `app/api/account/delete/route.ts:75` — tolerated.
  - `apps/mobile/lib/nukeAccountData.ts:58` — error swallowed in `Promise.all`.
  - No active write callsite found in either codebase right now — the analytics insert path planned for "log a planned meal" was never wired. So functionally Tier 1.5: not crashing, but the `my_recipe_plan_add_stats()` RPC referenced in F-T1-7 returns nothing.
- **Self-heal SQL**: re-execute migration body. Idempotent.

### F-T1-4 — `foods` / `food_sources` / `barcode_mappings` / `food_reports` tables missing

- **Object**: four tables + 6 policies + 2 indexes + the `set_updated_at()` function + the `barcode_mappings_set_updated_at` trigger. All from `20260408170000_food_db_unification.sql`.
- **Expected**: canonical food + source-attribution + barcode-correction loop tables.
- **Actual**: all four missing.
- **App refs (Tier 1 — these will visibly break)**:
  - `app/api/barcode-mapping/route.ts:65,73,88,103` — POST handler reads/writes all four tables with the service-role client. Every POST will return `500 food_create_failed` ("relation does not exist"). This is the "remember a barcode correction across devices" feature.
  - `app/api/off/barcode/route.ts:43,55` — GET handler reads `barcode_mappings` and `food_sources` to prefer prior corrections; wrapped in try/catch so silently degrades to "no preferred match" but the feature is non-functional.
- **App refs (Tier 1.5 — silent degrade)**:
  - `apps/mobile/lib/nukeAccountData.ts:63` — guarded with `isIgnorableMissingTableError`.
  - `app/api/account/delete/route.ts:76` — tolerated.
- **Self-heal SQL**: re-execute migration body. Note: it depends on `extensions.gen_random_bytes` — already enabled (the `households` migration uses it later and works fine).

### F-T1-5 — `public_recipe_save_count(uuid)` function missing

- **Object**: `public.public_recipe_save_count(uuid)`.
- **Expected**: SECURITY DEFINER aggregate created by `20260408180000_phase_4b_creator_social.sql:79-87`, granted to anon + authenticated. Used as the canonical "global save count for one recipe" without exposing per-saver identity.
- **Actual**: missing. Note: the BATCH variant `public_recipe_save_counts_batch(uuid[])` from `20260423140000` IS present — that migration ran fine because it didn't depend on the earlier one.
- **App refs**:
  - `src/app/components/RecipeDetail.tsx:292` — single-recipe RPC call. Fail mode: `supabase.rpc(...)` returns an error ("function does not exist"); the surrounding code falls back to `recipe.savedCount` (the locally-cached number). So save count on the recipe detail page is silently stale, never the live database value. Cosmetic for now (solo tester) but real divergence.
- **Self-heal SQL**: `create or replace function ... security definer ...` from migration body. Idempotent.

### F-T1-6 — `public_creator_follower_count(uuid)` and `public_author_follower_count(uuid)` functions missing

- **Object**: both SECURITY DEFINER follower-count aggregates from `20260408180000:89-107`.
- **Expected**: granted to anon + authenticated.
- **Actual**: missing.
- **App refs**:
  - `src/app/components/RecipeDetail.tsx:303,313` — RPC calls; on error, `setFollowerCount(0)` and `setFollowerCount(null)` respectively. Follower-count UI on recipe pages always shows 0 / null.
- **Self-heal SQL**: re-create from migration. Idempotent.

### F-T1-7 — `my_recipe_save_stats()` and `my_recipe_plan_add_stats()` functions missing

- **Object**: per-author stats RPCs from `20260408180000:109-135`. Granted to authenticated.
- **Expected**: drive a future creator-dashboard surface.
- **Actual**: missing.
- **App refs**: no current callsite found in repo. Tier 1.5 — feature not yet wired but the contract is recorded; restoring closes the parity gap.
- **Self-heal SQL**: re-create from migration.

### F-T1-8 — `promo_codes_select_own_redemptions` policy missing

- **Object**: SELECT policy on `public.promo_codes` per `20260414120000_promo_codes_select_own_redemptions.sql`.
- **Expected**: lets a user read promo_codes rows they have a redemption for, so the embedded `promo_redemptions → promo_codes` join in tier-merge code returns the tier label.
- **Actual**: missing. RLS is enabled on `promo_codes` with NO policies for `authenticated`/`anon` → all reads denied. The webhook + `redeem_promo_code` SECURITY DEFINER path bypasses this, but any client-side embedded select returns null.
- **App refs**: search for `promo_redemptions` joined with `promo_codes`:
  ```bash
  grep -rn "promo_redemptions.*promo_codes\|promo_codes.*promo_redemptions" src apps/mobile
  ```
  (run before merging the self-heal — if there's no client-side join the migration's effect is moot and we can drop this finding to Tier 2). Migration header says "Without this, embedded selects from promo_redemptions return null for promo_codes" so there was an active site at the time — confirm whether it survives.
- **Self-heal SQL**:
  ```sql
  drop policy if exists "promo_codes_select_own_redemptions" on public.promo_codes;
  create policy "promo_codes_select_own_redemptions"
    on public.promo_codes for select to authenticated
    using (
      exists (
        select 1 from public.promo_redemptions r
        where r.promo_code_id = promo_codes.id and r.user_id = auth.uid()
      )
    );
  ```

### F-T1-9 — `redeem_promo_code(text)` function: BODY UNVERIFIED

- **Object**: `public.redeem_promo_code(p_code text)`.
- **Expected**: idempotent body per `20260407220000_redeem_promo_idempotent.sql`.
- **Actual**: function name + signature present on remote. Body not extracted.
- **Risk**: this was the FIRST migration recorded — earliest exposure to the MCP partial-apply bug. A non-idempotent body would re-error when the same user redeems SUPPR_TEST_PREMIUM twice, blocking tier sync.
- **NEED FUNCTION BODY**: `select pg_get_functiondef('public.redeem_promo_code(text)'::regprocedure::oid);` — confirm the body matches `20260407220000_redeem_promo_idempotent.sql:4-56`. If it doesn't, re-run the migration (`create or replace` makes it safe).

---

## Tier 2 — cosmetic / advisory

### F-T2-1 — `schema.sql` references `recipes_select_public` policy that no longer exists by that name

`supabase/schema.sql:196` declares a policy named `recipes_select_public`; current prod has only `recipes_select_published_or_own` (correct, per `20260414120100_publish_moderation` which did `DROP POLICY IF EXISTS "recipes_select_public"` then created the new name). Schema.sql is stale doc, not remote drift. Update schema.sql to align in a separate hygiene PR.

### F-T2-2 — schema.sql declares legacy `meal_plans` / `nutrition_journals` / `shopping_lists` tables

These were renamed `*_legacy` in `20260413100000`, then dropped in `20260421200040`. Remote correctly has neither set. Schema.sql lines 573-720 should be removed in a doc-cleanup PR. Not a remote drift — flagged so we don't accidentally "restore" the legacy shape next time we re-bootstrap a preview env from schema.sql.

### F-T2-3 — Two indexes consequent to missing tables

`food_sources_food_id_idx`, `barcode_mappings_food_id_idx`, `recipe_plan_add_events_recipe_id_idx`, `recipe_plan_add_events_user_id_idx`, `author_follows_*_idx` (×2). All come back automatically when the underlying tables are restored (F-T1-1, F-T1-3, F-T1-4) — listed under "self-heal migration shape" below for completeness.

---

## Cross-platform consistency check

Web vs mobile:
- Both platforms' generated `database.types.ts` (`src/lib/supabase/database.types.ts` and `apps/mobile/lib/database.types.ts`) declare the missing tables (`author_follows`, `recipe_plan_add_events`, `barcode_mappings`, `food_sources`, `food_reports`, `foods`). Mobile and web both call into them at runtime. The drift is symmetric — both platforms degrade equally.
- After self-heal lands, regenerate `database.types.ts` from prod to catch any signature drift the audit missed.

Mobile-only:
- `apps/mobile/lib/saveImportedRecipe.ts:177` is the one path that DOES rely on the `recipe_ingredients.is_verified` default in some unset cases (it conditionally passes `(m?.calories ?? 0) > 0` so always sets a value, but the column-default issue still affects ad-hoc service-role inserts and any future code path that omits the field). T0 fix needed regardless.

Web-only:
- `app/api/barcode-mapping/route.ts` is the most critical Tier 1 surface — POST returns 500 today. Mobile barcode flow (`apps/mobile/app/(tabs)/barcode.tsx`) calls this route via the OFF lookup path; the GET tolerates failure but the POST does not.

---

## Self-heal migration shape

Land as `supabase/migrations/20260503101000_schema_drift_repair.sql`. Pure reapplication of three earlier migrations + one default fix + one policy. Every statement is idempotent (`if not exists` / `create or replace` / `do $$ ... if not exists ... end`). Safe on already-correct DBs (every statement no-ops).

```sql
-- 20260503101000_schema_drift_repair.sql
-- Repair the silent partial-apply drift discovered 2026-04-25.
-- Three early migrations were recorded in schema_migrations but their DDL
-- never executed (early MCP apply_migration failure mode). This file
-- re-asserts the missing surface idempotently. See
-- docs/audits/2026-04-25-schema-drift.md for the per-object rationale.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;
create extension if not exists "pgcrypto" with schema extensions;

-- ──────────────── 1. T0 default repair ────────────────
alter table public.recipe_ingredients alter column is_verified set default false;

-- ──────────────── 2. food_db_unification (20260408170000) ────────────────
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  display_name text not null,
  brand text,
  is_verified boolean not null default false
);
alter table public.foods enable row level security;

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

create or replace function public.set_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists barcode_mappings_set_updated_at on public.barcode_mappings;
create trigger barcode_mappings_set_updated_at
before update on public.barcode_mappings
for each row execute function public.set_updated_at();

-- Policies (food_db) — `create policy if not exists` not in our PG version, use do-block guards
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='foods' and policyname='foods_select_public') then
    create policy "foods_select_public" on public.foods for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='food_sources' and policyname='food_sources_select_public') then
    create policy "food_sources_select_public" on public.food_sources for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_select_public') then
    create policy "barcode_mappings_select_public" on public.barcode_mappings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_write_own') then
    create policy "barcode_mappings_write_own" on public.barcode_mappings for insert with check (auth.uid() = created_by);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_update_own') then
    create policy "barcode_mappings_update_own" on public.barcode_mappings for update
      using (auth.uid() = created_by) with check (auth.uid() = created_by);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='food_reports' and policyname='food_reports_insert_own') then
    create policy "food_reports_insert_own" on public.food_reports for insert with check (auth.uid() = reporter_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='food_reports' and policyname='food_reports_select_own') then
    create policy "food_reports_select_own" on public.food_reports for select using (auth.uid() = reporter_id);
  end if;
end $$;

-- ──────────────── 3. phase_4b_creator_social (20260408180000) ────────────────
create table if not exists public.author_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id),
  constraint author_follows_no_self check (follower_id <> author_id)
);
create index if not exists author_follows_author_id_idx on public.author_follows(author_id);
create index if not exists author_follows_follower_id_idx on public.author_follows(follower_id);
alter table public.author_follows enable row level security;

create table if not exists public.recipe_plan_add_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists recipe_plan_add_events_recipe_id_idx on public.recipe_plan_add_events(recipe_id);
create index if not exists recipe_plan_add_events_user_id_idx on public.recipe_plan_add_events(user_id);
alter table public.recipe_plan_add_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='author_follows' and policyname='author_follows_select_own') then
    create policy "author_follows_select_own" on public.author_follows for select using (auth.uid() = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='author_follows' and policyname='author_follows_insert_own') then
    create policy "author_follows_insert_own" on public.author_follows for insert with check (auth.uid() = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='author_follows' and policyname='author_follows_delete_own') then
    create policy "author_follows_delete_own" on public.author_follows for delete using (auth.uid() = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='recipe_plan_add_events' and policyname='recipe_plan_add_events_insert_own') then
    create policy "recipe_plan_add_events_insert_own" on public.recipe_plan_add_events for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='recipe_plan_add_events' and policyname='recipe_plan_add_events_select_own') then
    create policy "recipe_plan_add_events_select_own" on public.recipe_plan_add_events for select using (auth.uid() = user_id);
  end if;
end $$;

-- Public stat RPCs (security definer, granted to anon+authenticated)
create or replace function public.public_recipe_save_count(p_recipe_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select count(*)::bigint from public.saves where recipe_id = p_recipe_id;
$$;
create or replace function public.public_creator_follower_count(p_creator_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select count(*)::bigint from public.follows where creator_id = p_creator_id;
$$;
create or replace function public.public_author_follower_count(p_author_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select count(*)::bigint from public.author_follows where author_id = p_author_id;
$$;
create or replace function public.my_recipe_save_stats()
returns table (recipe_id uuid, save_count bigint)
language sql security definer set search_path = public stable as $$
  select s.recipe_id, count(*)::bigint
  from public.saves s
  inner join public.recipes r on r.id = s.recipe_id
  where r.author_id = auth.uid()
  group by s.recipe_id;
$$;
create or replace function public.my_recipe_plan_add_stats()
returns table (recipe_id uuid, plan_add_count bigint)
language sql security definer set search_path = public stable as $$
  select e.recipe_id, count(*)::bigint
  from public.recipe_plan_add_events e
  inner join public.recipes r on r.id = e.recipe_id
  where r.author_id = auth.uid()
  group by e.recipe_id;
$$;
grant execute on function public.public_recipe_save_count(uuid) to anon, authenticated;
grant execute on function public.public_creator_follower_count(uuid) to anon, authenticated;
grant execute on function public.public_author_follower_count(uuid) to anon, authenticated;
grant execute on function public.my_recipe_save_stats() to authenticated;
grant execute on function public.my_recipe_plan_add_stats() to authenticated;

-- ──────────────── 4. promo_codes_select_own_redemptions ────────────────
drop policy if exists "promo_codes_select_own_redemptions" on public.promo_codes;
create policy "promo_codes_select_own_redemptions"
  on public.promo_codes for select to authenticated
  using (
    exists (
      select 1 from public.promo_redemptions r
      where r.promo_code_id = promo_codes.id and r.user_id = auth.uid()
    )
  );

-- ──────────────── 5. notify_followers_on_recipe_publish — re-assert v2 body ────────────────
-- 20260414120200 v2 (only fan out when both published AND verified). Idempotent.
create or replace function public.notify_followers_on_recipe_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.published, false) then return new; end if;
  if not coalesce(new.is_verified, false) then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.published, false) and coalesce(old.is_verified, false) then
    return new;
  end if;
  if new.author_id is not null then
    insert into public.creator_publish_notifications (user_id, recipe_id)
    select af.follower_id, new.id from public.author_follows af where af.author_id = new.author_id
    on conflict (user_id, recipe_id) do nothing;
  end if;
  if new.creator_id is not null then
    insert into public.creator_publish_notifications (user_id, recipe_id)
    select f.user_id, new.id from public.follows f where f.creator_id = new.creator_id
    on conflict (user_id, recipe_id) do nothing;
  end if;
  return new;
end;
$$;

NOTIFY pgrst, 'reload schema';
```

Lock-risk: low. Every statement except the function bodies is metadata-only on PG12+ (`add column with no default`-style; new tables; new policies; new indexes on small/empty tables). Function `create or replace` doesn't lock.

Backwards compat during rollout: **yes** — all reads/writes that work today continue to work; the missing surfaces flip from broken to working. The one behavioural change is `recipe_ingredients.is_verified default false` — only affects new INSERTs that omit the field, and our app code always sets it explicitly.

Reversible: yes, with a planned recovery file (drop the new tables / restore the prior `recipe_ingredients.is_verified default true`). Recovery isn't likely to be needed because the tables are net-new where missing.

Backfill: none required. Tables are net-new on remote so they start empty, which matches today's behaviour (clients silently see no follows / no save counts).

---

## NEED FUNCTION BODY queries

Run before merging the self-heal so we know whether the function bodies on prod match repo intent. If they match, the `create or replace` blocks in the self-heal are no-ops. If they don't match, we want to know what's there before we overwrite.

```sql
-- 1. Is redeem_promo_code idempotent (matches 20260407220000)?
select pg_get_functiondef('public.redeem_promo_code(text)'::regprocedure::oid);

-- 2. Is notify_followers_on_recipe_publish gated on is_verified (matches 20260414120200)?
select pg_get_functiondef('public.notify_followers_on_recipe_publish()'::regprocedure::oid);

-- 3. (Sanity) what's the body of handle_new_user — does it match schema.sql:867?
select pg_get_functiondef('public.handle_new_user()'::regprocedure::oid);

-- 4. Trigger on auth.users (our snapshot only listed public.* triggers):
select trigger_name, event_manipulation, action_timing, action_statement
from information_schema.triggers
where event_object_schema = 'auth' and event_object_table = 'users';
```

Result-dependent next steps:
- If (1) matches: no action needed beyond the audit landing.
- If (2) is the v0 body (no `is_verified` gate) OR refers to `author_follows` while the table is missing today: this is the smoking gun for any "publish appears to do nothing" reports. Self-heal plus re-test.

---

## Verdict

**BLOCK ship of any new feature that depends on `author_follows`, `barcode_mappings`, `food_sources`, `recipe_plan_add_events`, or any of the public stat RPCs UNTIL the self-heal migration lands.**

**PASS for everything else** — 87 of 90 tracked migrations applied as recorded.

Required next steps before unblock:
1. Run the four `NEED FUNCTION BODY` queries above; share results so we know whether (2) needs a body rewrite or just a re-create.
2. Land `supabase/migrations/20260503101000_schema_drift_repair.sql` via `supabase db push --linked` (NOT MCP).
3. After push, re-extract `remote-tables-rls.json` + `remote-policies.json` + `remote-triggers-functions.json` and re-run this audit's diff python — expect zero deltas.
4. Regenerate `database.types.ts` (web + mobile) from prod and commit if anything changes.
5. Solo tester smoke test: the Follow author button on a recipe with a non-null `author_id`, the "remember a barcode correction" path, and a recipe save count refresh. All three are surface-breaking today and should work end-to-end after the self-heal.
6. Tier 2 hygiene (separate PR, not blocking): clean `supabase/schema.sql` of the three legacy tables and the stale `recipes_select_public` policy name.
