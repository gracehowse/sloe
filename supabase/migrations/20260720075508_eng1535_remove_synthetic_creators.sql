-- ENG-1535 — remove the five invented "launch partner" personas from the
-- public creator plane. These rows were inserted by 20260702120900 without a
-- real person, consent, recipes, or an in-product disclosure.
--
-- Referential behaviour is already safe and intentional:
--   recipes.creator_id -> ON DELETE SET NULL
--   follows.creator_id -> ON DELETE CASCADE
-- The shared client loader also rejects these fixed IDs so the rail disappears
-- immediately on deploy even before this migration reaches every environment.
delete from public.creators
where id in (
  'a1000001-0001-4000-8000-000000000001',
  'a1000001-0001-4000-8000-000000000002',
  'a1000001-0001-4000-8000-000000000003',
  'a1000001-0001-4000-8000-000000000004',
  'a1000001-0001-4000-8000-000000000005'
);
