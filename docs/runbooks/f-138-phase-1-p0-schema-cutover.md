# F-138 Phase 1 P0 schema — application runbook

**Trigger PR:** Phase 1 of `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`
**Migration file:** `supabase/migrations/20260512100000_user_foods_p0_hardening.sql`
**Owner:** Grace (applies the migration via `supabase db push --linked`)
**Date:** 2026-05-08

This runbook covers what Grace needs to do to apply the F-138 Phase 1
P0 schema migration safely. The PR ships the migration file and the
matching read-path code change to `lookupBarcode`, but the migration
must be applied to prod before the new code can read from the new
table.

## What changes

**Five P0 items in one migration:**
1. **Numeric + structural constraint pack** on `user_foods` — sanity bounds on calories (≤2000), macros (≤100), sodium (≤50000), barcode length, and structural subset rules (sugar ≤ carbs, sat-fat ≤ fat, fiber ≤ carbs).
2. **SELECT RLS tightened** — pre-fix `using (true)` allowed any authed user to read every pending submission (mid-edit garbage included). Post-fix: `verification_status = 'verified' OR submitted_by = auth.uid()`.
3. **State-machine guard** — owners can no longer self-promote `pending → verified`. New `admin_users` table gates the transition; service-role bypasses for automation.
4. **Reset on macro edit** — if any nutrition column changes on a `verified` row, the row reverts to `pending` and clears `verified_at`/`verified_by`. Vandalism vector closed.
5. **`verified_food_canonical` projection table** — single PK lookup per barcode for the canonical verified value. Auto-recomputed via trigger when verification_status changes. Backfilled from existing verified rows at migration time.

**Code change:** `lookupBarcode` in `apps/mobile/lib/verifyRecipe.ts` reads from `verified_food_canonical` first (PK hit), then own `user_foods` row (RLS allows owner-pending), then OFF. Lex-sort bug fixed.

## Application order — important

1. **Apply migration first** (before merging the PR). The new code reads from `verified_food_canonical` which doesn't exist until the migration runs.

2. **Then merge the PR.** Once migration is live, the new lookupBarcode code works correctly on first deploy.

If you merge the PR without applying the migration, the canonical query will silently return `null` (PostgREST falls through gracefully) and the user_foods fallback will still work — but you lose the new performance optimisation and the no-rejected guarantee until the migration lands.

## How to apply

Per `CLAUDE.md` — never apply via MCP `apply_migration`. Use the CLI:

```bash
cd /Users/graceturner/Suppr-1
supabase db push --linked
```

The migration is idempotent: re-running it doesn't break anything (constraints + triggers + functions are dropped before re-creating).

## Adding yourself as the first admin

After the migration is applied, you'll need to add yourself to `admin_users` so you can manually verify pending corrections (Phase 4 ships an admin UI; until then it's SQL).

```sql
-- Run from the Supabase Dashboard SQL editor (service role) OR
-- from `supabase db psql` locally.
insert into public.admin_users (user_id, granted_by, note)
values (
  (select id from auth.users where email = 'gracehowse@outlook.com'),
  null,
  'Founder — initial admin seed'
);
```

Without an admin row, no rows can transition to `verified` until the
Phase 2 cross-submission consensus job lands. That's fine for the
N=1 tester period, but verify yourself sooner so you can manually
bless your own test submissions if needed.

## Rolling back

If something is wrong with the migration:

```sql
-- Drop everything the migration added (in reverse order).
drop trigger if exists user_foods_after_status_change on public.user_foods;
drop trigger if exists user_foods_reset_verification_on_macro_edit on public.user_foods;
drop trigger if exists user_foods_guard_status_transition on public.user_foods;
drop function if exists public.user_foods_after_status_change();
drop function if exists public.user_foods_reset_verification_on_macro_edit();
drop function if exists public.user_foods_guard_status_transition();
drop function if exists public.recompute_verified_food_canonical(text);
drop table if exists public.verified_food_canonical;
drop table if exists public.admin_users;

-- Restore the loose SELECT policy:
drop policy if exists "Authenticated users can read verified or own user foods" on public.user_foods;
create policy "Authenticated users can read user foods"
  on public.user_foods for select to authenticated using (true);

-- Drop the constraint pack (names are explicit):
alter table public.user_foods
  drop constraint if exists user_foods_calories_bounds,
  drop constraint if exists user_foods_protein_bounds,
  drop constraint if exists user_foods_carbs_bounds,
  drop constraint if exists user_foods_fat_bounds,
  drop constraint if exists user_foods_fiber_bounds,
  drop constraint if exists user_foods_sugar_bounds,
  drop constraint if exists user_foods_sodium_bounds,
  drop constraint if exists user_foods_satfat_bounds,
  drop constraint if exists user_foods_serving_size_bounds,
  drop constraint if exists user_foods_barcode_length,
  drop constraint if exists user_foods_name_nonempty,
  drop constraint if exists user_foods_sugar_le_carbs,
  drop constraint if exists user_foods_satfat_le_fat,
  drop constraint if exists user_foods_fiber_le_carbs;
```

The mobile read-path change is backwards-compatible (canonical query falls through to user_foods if the canonical table doesn't exist, since PostgREST returns 404 PGRST205 which gets caught by the existing try/catch).

## Verifying after apply

1. Confirm constraints are live:
   ```sql
   select conname from pg_constraint
   where conrelid = 'public.user_foods'::regclass
     and conname like 'user_foods_%';
   ```
   Expect 14 rows (calories, protein, carbs, fat, fiber, sugar, sodium, satfat, serving_size, barcode_length, name_nonempty, sugar_le_carbs, satfat_le_fat, fiber_le_carbs).

2. Confirm canonical table is populated for any pre-existing verified rows:
   ```sql
   select count(*) from public.verified_food_canonical;
   ```
   Should match `select count(*) from public.user_foods where verification_status = 'verified'` (one row per barcode, not per submission).

3. Confirm RLS — try to read a pending row owned by another user (should return 0 rows).

4. Confirm state-machine guard — try `update user_foods set verification_status = 'verified' where ... and submitted_by = auth.uid()` as a non-admin authed user. Should raise:
   `Only admins can change verification_status (got pending → verified)`.

## Cost / impact

- **Disk:** negligible. `verified_food_canonical` is one row per barcode; expected <1MB even at 100k barcodes.
- **Write latency:** minor — every user_foods status change runs the recompute trigger. ~5ms per change. Imperceptible at our scale.
- **Read latency:** **better** — single PK hit on canonical replaces the 5-row sort-and-pick on user_foods.

## What's next (after this lands)

- Phase 2: server-side plausibility gate (Atwater check + structural rules) at submit time + cross-submission consensus auto-promotion.
- Phase 3: two-path submit UI ("Save to my foods" vs "Submit to database") + vote UI + "you helped N people" surface.
- Phase 4: admin triage page + audit log + flagging.
- Phase 5: Claude-vision label-photo auto-verify + submitter trust score.
