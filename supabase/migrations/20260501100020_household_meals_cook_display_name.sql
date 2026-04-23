-- Household Netflix-model v1 (2026-05-01) — cook display-name snapshot.
--
-- `household_meals.added_by` is an auth.users FK. When a member leaves
-- the household, their membership row is deleted, but historical meals
-- must continue to render with a legible attribution ("Grace cooked
-- this") rather than an unresolved UUID. The read path currently joins
-- `added_by` → `household_members.display_name`, which returns null
-- once the member leaves.
--
-- Snapshot the display name at insert time. Cheap (~20 bytes/row) and
-- eliminates the join entirely for the attribution label. The real
-- membership row still drives live permission checks.

alter table public.household_meals
  add column if not exists cook_display_name text;

-- One-off backfill from current membership rows. Rows added before
-- this migration get the cook's current name; post-migration rows
-- snapshot at insert. Members who have already left remain null and
-- the client falls back to "A member" for those historical rows.
update public.household_meals hm
set cook_display_name = m.display_name
from public.household_members m
where hm.added_by = m.user_id
  and hm.household_id = m.household_id
  and hm.cook_display_name is null
  and m.display_name is not null;

NOTIFY pgrst, 'reload schema';
