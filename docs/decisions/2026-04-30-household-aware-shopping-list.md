# Household-aware shopping list (Honeydew parity)

**Date**: 2026-04-30
**Status**: Resolved (shipped)
**Area**: Shopping / Household / Real-time
**Owner**: orchestrator → executor agent
**Related**: `docs/research/household-planning-scope.md`,
`docs/planning/2026-04-22-household-netflix-model-spec.md`,
`supabase/migrations/20260504100100_household_shopping.sql`

## Context

Extended competitor audit (2026-04-30) flagged the shopping list as
the single biggest conversion blocker for the family-planner persona.
Verbatim from the audit:

> "Honeydew syncs across spouses in seconds; checks propagate live.
> Suppr's `ShoppingList.tsx` reads from `useAppData()` (per-user state)
> — no household-aware shopping fetch despite household plumbing
> existing in mobile (`HouseholdBar.tsx`) and on web
> (`HouseholdPanel.tsx`). Shopping list is per-user, not shared."

Suppr already had:
- `households`, `household_members`, `household_meals` tables (from
  `20260420100000_household_planning.sql`)
- A recursion-safe `auth_household_ids()` RLS helper
  (`20260423110000_household_rls_recursion_fix.sql`)
- Cross-platform `getMyHousehold` shared client at
  `src/lib/household/householdClient.ts`
- HouseholdBar / HouseholdPanel components on both platforms

But `shopping_items` was scoped exclusively by `user_id` — no
household column, no real-time. A household using the planner saw
the same shared dinner plan but had to coordinate the shopping list
verbally.

## Decision

Make `shopping_items` household-aware:

1. **Schema**: add `household_id` (FK, nullable, ON DELETE CASCADE),
   `checked_by` (FK auth.users, set null on delete), and `checked_at`.
   Migration: `supabase/migrations/20260504100100_household_shopping.sql`.

2. **RLS**: replace the legacy `Own shopping items` FOR ALL policy
   with four explicit per-action policies. Each policy permits
   `(household_id IS NULL AND user_id = auth.uid())` OR
   `(household_id IN auth_household_ids())`. The INSERT WITH CHECK
   pins `user_id = auth.uid()` so the audit trail can never be
   spoofed by another household member.

3. **Real-time**: register `shopping_items` with the
   `supabase_realtime` publication. Clients subscribe with a filter
   on `household_id=eq.<id>` for household users (`user_id=eq.<id>`
   for solo). RLS is re-checked on every change-event payload.

4. **Scope helper**: `src/lib/household/shoppingScope.ts` — pure
   functions both web and mobile call through. Pins:
   - solo reads filter `user_id = me AND household_id IS NULL`
   - household reads filter `household_id = active`
   - INSERT stamps both `user_id` (audit) AND `household_id` (scope)
   - real-time channel + filter formatted consistently

5. **Mobile UI** (`apps/mobile/app/shopping.tsx`):
   - "Shared with Sarah & Tom" banner above the list (Lucide Users
     icon, taps to household-settings)
   - Per-row attribution chip on fully-checked groups when a single
     household member toggled them
   - All writes go through scope helper

6. **Web UI** (`src/app/components/ShoppingList.tsx`): same banner
   + chip pattern, identical strings, identical attribution rules.

7. **Backward compat**: existing rows have `household_id = null` and
   stay visible to their original creator. No data migration. A user
   who joins a household after this ships keeps their old per-user
   list (it's invisible to the household, and the household's list
   is invisible to the legacy view) — deliberately, to avoid
   polluting a fresh shared list with stale items.

## Why these tradeoffs

- **Why a single nullable `household_id` column instead of a join
  table?** The 1:1 relationship (an item lives in EITHER a user's
  solo list OR a household's shared list, never both) is intrinsic
  to the domain. A join table would let the same item exist in two
  places simultaneously — semantically broken.
- **Why not auto-migrate solo items into a new household on join?**
  Three reasons: (a) the user might have a stale list from weeks
  ago, (b) it would surprise other household members with items
  they didn't add, (c) it forces a write on a read-only flow. The
  user can always regenerate from their plan — the planner now
  stamps `household_id` on the fresh items.
- **Why fall back to an immediate refetch on real-time events
  instead of merging change payloads?** Three event types (insert /
  update / delete) × two platforms = six branches to maintain. A
  scope-filtered refetch is one indexed query (~20ms typical) and
  matches the proven pattern in `apps/mobile/lib/notifications.ts`.

## Tests

- `tests/unit/shoppingScope.test.ts` — pure helper rules (10 tests)
- `tests/unit/householdShoppingMigration.test.ts` — migration RLS
  invariants (11 tests)
- `tests/unit/shoppingHouseholdScopeBackwardCompat.test.ts` — no
  data migration, no impersonation (4 tests)
- `tests/unit/useShoppingListStateHouseholdScope.test.tsx` —
  scope-aware reads + real-time subscription (4 tests)
- `tests/unit/shoppingListHouseholdSurfacing.test.tsx` — banner +
  attribution chip rendering (5 tests)
- `apps/mobile/tests/unit/shoppingHouseholdParity.test.ts` — both
  platforms import the same scope helper, render the same testIDs
  (9 tests)

## Apply path

**Migration is staged ONLY.** Per CLAUDE.md, never apply Supabase
migrations via MCP `apply_migration` for files under
`supabase/migrations/`. Grace runs:

```bash
supabase db push --linked
```

after reviewing the SQL.

## Follow-ups

- `data-integrity` review of the new RLS policies (sign-off)
- `analytics-engineer` to add `shopping_item_attribution_seen`
  event when the chip first renders for a multi-member household
- A small "who added this" surface on uncomplicated rows is a P2
  candidate; current design only attributes on fully-checked groups
  to avoid clutter
- Live RLS test against real Supabase deferred to `qa-lead`
