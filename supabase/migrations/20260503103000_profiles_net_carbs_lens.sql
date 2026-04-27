-- P2-26 (2026-04-25) — opt-in net-carbs lens for keto users.
--
-- Adds `profiles.net_carbs_lens_enabled boolean` (default false). When
-- the user opts in via Settings → Goals & Targets, every surface that
-- displays carbs swaps "Carbs: X g" → "Net carbs: max(0, X - fibre) g"
-- and the target value is interpreted as net rather than total.
--
-- Default false preserves current behaviour for existing users; no
-- silent regression. The shared helper at
-- `src/lib/nutrition/netCarbs.ts` is the single source of truth for the
-- math — every web + mobile surface consumes it.
--
-- Forward-only safe; idempotent. Apply via `supabase db push --linked`
-- (NOT MCP apply_migration).

set search_path = public;

alter table public.profiles
  add column if not exists net_carbs_lens_enabled boolean not null default false;

comment on column public.profiles.net_carbs_lens_enabled is
  'P2-26 (2026-04-25): when true, the user has opted into the net-carbs lens. Surfaces that display carbs swap "Carbs: X" → "Net carbs: max(0, X - fibre)" and target_carbs is interpreted as the net target. Default false; no silent regression.';
