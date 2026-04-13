-- Optional provenance for logged meals (USDA, barcode, AI, manual, etc.)
alter table nutrition_entries
  add column if not exists source text;

comment on column nutrition_entries.source is 'Human-readable data provenance, e.g. USDA FoodData Central, Open Food Facts, AI photo';
