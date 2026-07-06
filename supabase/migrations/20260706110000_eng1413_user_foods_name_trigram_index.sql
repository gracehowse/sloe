-- ENG-1413 (2026-07-05 deep audit, production readiness, PRA-012/IM-14,
-- pg_trgm half) — verifyIngredients (src/lib/nutrition/userFoodsLookup.ts,
-- searchUserFoods) runs an unindexed leading-wildcard `ilike('%term%')`
-- against `user_foods.name` once PER INGREDIENT during every recipe verify
-- pass. A leading wildcard cannot use a plain B-tree index (confirmed via
-- pg_indexes: user_foods has no index on `name` at all today), so this is a
-- full sequential scan per ingredient — a cost that scales linearly with
-- table size and multiplies by ingredient count per recipe.
--
-- THE FIX: enable pg_trgm (not present on this project — confirmed via
-- pg_extension) and add a GIN trigram index on `name`, following the
-- existing project convention for extension installs (pgcrypto, same
-- `with schema extensions` pattern). A trigram GIN index accelerates
-- `ilike`/`LIKE '%text%'` regardless of wildcard position.
--
-- Scope note: this migration covers the pg_trgm/index half of ENG-1413
-- only. The "bound the unbounded saves fetch" half needs an architectural
-- decision, not a mechanical fix — see the ENG-1413 Linear comment: the
-- fetched saves array is used both as an `isRecipeSaved` full-set
-- membership check AND as the `.length` input to the free-tier save-limit
-- gate (on both web and mobile), so a naive `.limit()` would silently
-- break the save indicator for older saves AND let free-tier users bypass
-- their save cap for any account with more saves than the limit.
--
-- FORWARD-ONLY SAFE: adds an extension + one index; touches no existing
-- column, policy, or query.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — MCP
-- rewrites schema_migrations.version to wall-clock NOW(), drifting from the
-- future-dated filename prefix used for monotonic ordering).

create extension if not exists "pg_trgm" with schema extensions;

create index if not exists idx_user_foods_name_trgm
  on public.user_foods
  using gin (name extensions.gin_trgm_ops);
