-- Remove ALL seeded / demo recipes from the database.
-- This covers:
-- 1. Fixed-UUID demo recipes
-- 2. Legacy community batch by description + seed author
-- 3. Demo creators
-- 4. Any remaining recipes from the seed author
-- Child rows cascade via FK constraints.

-- Fixed demo UUIDs
DELETE FROM public.recipes
WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
);

-- Legacy community seed batch
DELETE FROM public.recipes
WHERE description = 'Community seed recipe for Discover.'
  AND author_id = 'e9f85055-876b-4bde-9267-476567b16884'::uuid;

-- Any remaining recipes from the seed author (catches URL-seeded recipes)
DELETE FROM public.recipes
WHERE author_id = 'e9f85055-876b-4bde-9267-476567b16884'::uuid;

-- Demo creators
DELETE FROM public.creators
WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
);
