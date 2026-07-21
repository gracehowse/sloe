-- ============================================================================
-- 20260721100000_eng1602_household_shared_targets_rpc.sql
--
-- ENG-1602 -- fix: household share_targets opt-in never delivered real
-- cross-member numbers (data-correctness bug, not a security leak).
--
-- CONFIRMED ROOT CAUSE (verified live against prod, 2026-07-20 -- see the
-- Linear comment thread on ENG-1602):
--   When a member opts in via `household_members.share_targets = true`,
--   another member's client (`getMyHousehold()` in
--   src/lib/household/householdClient.ts, ~L457-470 pre-fix) tried to
--   cross-read that member's `profiles` (for targets) and
--   `nutrition_entries` (for consumed-today) directly via `.in(...)`. Both
--   tables' SELECT RLS is strictly self-only:
--     profiles          -> "profiles_select_own": auth.uid() = id
--     nutrition_entries -> "Own nutrition entries" (cmd ALL): auth.uid() = user_id
--   with no household carve-out added by any household migration. The
--   cross-member query silently returned zero rows (RLS just filters, no
--   error), and the client masked the empty result with hardcoded
--   fallbacks (householdClient.ts:539-544 pre-fix: targets 2000/130/250/65,
--   consumed 0, remaining = targets). Net effect: every opted-in member
--   rendered identical fabricated numbers regardless of their real goals
--   or intake -- worse than showing nothing, since it looked like sharing
--   worked. The inverse (leak when `share_targets` is off) was checked and
--   does NOT exist -- RLS is self-only in both directions regardless of
--   the flag; broken-closed, not broken-open.
--
-- WHY A SECURITY DEFINER FUNCTION, NOT AN RLS POLICY OR A VIEW:
--   RLS is row-level in Postgres, not column-level. A household-scoped
--   SELECT policy added to `profiles` would expose the WHOLE row (email,
--   every other column, not just target_*) to any co-member -- a much
--   bigger leak than the one being fixed. A plain view over `profiles`
--   inherits the same row-level limitation and still needs an RLS/GRANT
--   story underneath it. Postgres column-level GRANTs are the only other
--   real alternative and this codebase has zero precedent for them --
--   they don't compose cleanly with the RLS USING clauses already on
--   these tables. The established, repeatedly-validated pattern in this
--   codebase for "controlled cross-user read, narrow derived output,
--   consent re-checked server-side" is a SECURITY DEFINER RPC (23+
--   precedents under supabase/migrations/, `grep -l 'security definer'`).
--   The closest direct precedent is `household_join_by_invite_code`
--   (20260422100000, most recently hardened 20260720090000): it also runs
--   with elevated privilege specifically because RLS cannot let a
--   non-member read what it needs, but it only ever returns a handful of
--   safe, derived fields -- never a raw row. This migration follows the
--   exact same shape for the read side of household sharing.
--
-- WHAT THIS FUNCTION DOES:
--   `get_household_shared_targets(p_date_key)` operates on `auth.uid()`
--   only -- it takes no household id or user id argument, so there is
--   nothing client-suppliable to spoof. For every co-member of the
--   caller's household who has `share_targets = true` (excluding the
--   caller), it returns ONLY:
--     user_id, target_calories, target_protein, target_carbs, target_fat,
--     consumed_calories, consumed_protein, consumed_carbs, consumed_fat
--   `consumed_*` is aggregated server-side from that member's
--   `nutrition_entries` rows for `p_date_key`. The function re-verifies
--   BOTH household co-membership (resolved from the CALLER's own
--   `household_members` row -- never a client-supplied household id) AND
--   `share_targets = true` inside the function body on every call; it
--   never trusts the client's cached `members` list. This mirrors the
--   co-membership + consent re-check `household_join_by_invite_code`
--   already does for its own operation.
--
--   No other `profiles` column (display_name, email, weight, or any other
--   PII) and no raw `nutrition_entries` row is ever selected into the
--   return set -- only the four target numbers and four aggregated-today
--   numbers per co-member.
--
-- WHY `p_date_key` IS A PARAMETER, NOT A BARE `current_date` READ:
--   `householdClient.ts`'s `todayKey()` (Build 41 fix, lineage
--   20260501100000) deliberately derives the CALLER's LOCAL calendar
--   date, not the UTC date -- `nutrition_entries.date_key` is always
--   written from the logging user's local day everywhere else in the
--   app. Postgres's `current_date` inside a SECURITY DEFINER function
--   reflects the DB session's timezone (UTC on Supabase), not the
--   caller's device timezone. Defaulting to it here would silently
--   reintroduce the exact UTC-vs-local mismatch Build 41 already fixed
--   (TestFlight `AJ_dfDvM2j6rnkOAgHTpwig`, "calories wildly high vs
--   target") for any household member near midnight in a non-UTC offset.
--   The client MUST always pass its own `todayKey()` explicitly as
--   `p_date_key` (see `src/lib/household/householdClient.ts`); the
--   `current_date` default exists only so the function has defined
--   behaviour if ever invoked without an argument (ad-hoc SQL / manual
--   debugging), not as a path the app is expected to take.
--
-- Apply step (Grace runs this -- Claude/MCP must NOT apply, per
-- .claude/CLAUDE.md: MCP `apply_migration` rewrites
-- schema_migrations.version to wall-clock NOW() and drifts from this
-- file's deliberately-ordered timestamp):
--   supabase db push --linked
-- ============================================================================

create or replace function public.get_household_shared_targets(
  p_date_key date default current_date
)
returns table (
  user_id uuid,
  target_calories integer,
  target_protein integer,
  target_carbs integer,
  target_fat integer,
  consumed_calories numeric,
  consumed_protein numeric,
  consumed_carbs numeric,
  consumed_fat numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
begin
  if v_uid is null then
    return; -- not authenticated: empty set, never an error leaking info.
  end if;

  -- Resolve the caller's OWN current household from THEIR OWN row only.
  -- Mirrors the client's defensive "most recent membership" read
  -- (`getMyHousehold` / `createHousehold` in householdClient.ts -- order
  -- by joined_at desc, limit 1) so a caller with legacy duplicate
  -- household_members rows (pre-unique-constraint orphans, TestFlight
  -- AB75VswC) resolves to the same household the client itself resolves
  -- to. This is the co-membership check -- there is no other input to
  -- this function that could name a different household.
  select hm.household_id
    into v_household_id
  from public.household_members hm
  where hm.user_id = v_uid
  order by hm.joined_at desc
  limit 1;

  if v_household_id is null then
    return; -- caller is not in a household: empty set.
  end if;

  -- Co-members of THAT household who have opted in. Both predicates
  -- (`hm.household_id = v_household_id` and `hm.share_targets = true`)
  -- are re-checked here, server-side, inside the definer boundary --
  -- this function takes no household id or user id argument, so there
  -- is nothing supplied by the client to trust or mistrust in the first
  -- place.
  return query
  select
    hm.user_id,
    p.target_calories,
    p.target_protein,
    p.target_carbs,
    p.target_fat,
    coalesce(sum(ne.calories), 0)::numeric as consumed_calories,
    coalesce(sum(ne.protein), 0)::numeric as consumed_protein,
    coalesce(sum(ne.carbs), 0)::numeric as consumed_carbs,
    coalesce(sum(ne.fat), 0)::numeric as consumed_fat
  from public.household_members hm
  join public.profiles p
    on p.id = hm.user_id
  left join public.nutrition_entries ne
    on ne.user_id = hm.user_id
   and ne.date_key = p_date_key
  where hm.household_id = v_household_id
    and hm.user_id <> v_uid
    and hm.share_targets = true
  group by hm.user_id, p.target_calories, p.target_protein, p.target_carbs, p.target_fat;
end;
$$;

-- This is a brand-new function created AFTER the ENG-1307 default-privilege
-- flip (20260702126100: `alter default privileges for role postgres in
-- schema public revoke execute on functions from public, anon,
-- authenticated`), so nothing is implicitly granted at CREATE time. The
-- explicit revoke + grant pair below is belt-and-braces (mirrors the
-- `auth_owns_collection` precedent, 20260703140000): authenticated only,
-- anon NEVER.
revoke all on function public.get_household_shared_targets(date) from public;
grant execute on function public.get_household_shared_targets(date) to authenticated;

comment on function public.get_household_shared_targets(date) is
  'ENG-1602: SECURITY DEFINER read of co-members targets/consumed-today. Re-verifies household co-membership (from the callers own household_members row) AND share_targets = true server-side for every returned row -- never trusts a client-supplied household id or member list. Exposes ONLY target_calories/protein/carbs/fat plus consumed_calories/protein/carbs/fat per opted-in co-member -- never a raw profiles or nutrition_entries row, never any other profiles column (no display_name, email, weight, etc). authenticated-only execute grant, never anon. See householdClient.ts getMyHousehold() for the caller.';

NOTIFY pgrst, 'reload schema';
