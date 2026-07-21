-- ENG-1336: first-class nutrition-label logging persists a truthful source
-- instead of collapsing reviewed OCR values into `manual` or `barcode`.
--
-- Do not apply via MCP apply_migration. Push this tracked file with
-- `supabase db push --linked` so schema_migrations keeps the file timestamp.

-- Validate the superset constraint before replacing the live one, so the
-- table never has an unconstrained write window during deployment.

alter table public.nutrition_entries
  add constraint nutrition_entries_source_canonical_v2
  check (
    source is null
    or source in (
      'USDA FoodData Central',
      'USDA',
      'FatSecret',
      'Open Food Facts',
      'Open Food Facts (adjusted)',
      'Edamam',
      'manual',
      'custom',
      'custom_food',
      'Recipe',
      'Saved meal',
      'apple_health',
      'AI voice',
      'AI photo',
      'Nutrition label',
      'Suppr',
      'Estimated',
      'Unverified',
      'barcode'
    )
  )
  not valid;

alter table public.nutrition_entries
  validate constraint nutrition_entries_source_canonical_v2;

alter table public.nutrition_entries
  drop constraint nutrition_entries_source_canonical;

alter table public.nutrition_entries
  rename constraint nutrition_entries_source_canonical_v2
  to nutrition_entries_source_canonical;
