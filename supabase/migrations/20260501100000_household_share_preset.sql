-- Household Netflix-model v1 (2026-05-01) — per-member sharing preset.
--
-- Supersedes the owner-level `households.share_lunch` boolean. Each
-- member now chooses their own sharing granularity from five presets:
--   - all              every slot, every day
--   - dinners          dinners only (default)
--   - dinners_weekends weekday dinners + weekend all meals
--   - lunch_dinner     lunch + dinner every day
--   - custom           honours `household_member_share_targets` grid
--
-- `share_lunch` stays on the row for backwards-read compatibility
-- until the client sweep lands; a later migration will drop it.
-- The `custom` preset preserves the per-cell override grid that
-- `household_member_share_targets` already stores.

alter table public.household_members
  add column if not exists share_preset text not null default 'dinners';

alter table public.household_members
  drop constraint if exists household_members_share_preset_check;

alter table public.household_members
  add constraint household_members_share_preset_check
  check (share_preset in ('all', 'dinners', 'dinners_weekends', 'lunch_dinner', 'custom'));

-- Backfill existing rows in households that opted into share_lunch
-- so their members default to `lunch_dinner` rather than `dinners`.
update public.household_members hm
set share_preset = 'lunch_dinner'
where share_preset = 'dinners'
  and hm.household_id in (
    select id from public.households where share_lunch = true
  );

create index if not exists idx_household_members_preset
  on public.household_members (household_id, share_preset);

NOTIFY pgrst, 'reload schema';
