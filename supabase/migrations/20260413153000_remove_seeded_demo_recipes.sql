-- Remove fixed-UUID demo recipes (historical supabase/seed.sql) and legacy SQL batch Discover seeds.
-- Child rows (recipe_ingredients, saves, etc.) cascade where defined.

delete from public.recipes
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
);

delete from public.recipes
where description = 'Community seed recipe for Discover.'
  and author_id = 'e9f85055-876b-4bde-9267-476567b16884'::uuid;

delete from public.creators
where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
);
