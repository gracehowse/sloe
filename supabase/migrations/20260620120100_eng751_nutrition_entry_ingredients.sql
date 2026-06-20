-- ENG-751 — per-item AI/photo/voice meal snapshot child table.
--
-- The "By ingredient" macro-detail view derives per-ingredient macros for
-- logged RECIPES from `recipe_ingredients × portion_multiplier`, reconciled to
-- the entry total. AI/photo/voice meals have NO `recipe_id`; their per-item
-- breakdown lived only in the unpersisted AI response, so those entries rendered
-- as a single self-named fallback line (correct, but lossy — the AI-resolved
-- item name + un-rounded macros + per-item confidence/source were dropped on
-- commit). This snapshot table persists that breakdown so those entries split.
--
-- Trust posture: every row carries `confidence` + `source`. Low-confidence items
-- are FLAGGED downstream, never silently filled (CLAUDE.md "no invented nutrition
-- values"). Snapshots are IMMUTABLE: the write path inserts once at commit; there
-- is no client update/delete path (cascade handles delete with the parent entry).
--
-- Precision: `nutrition_entries` stores `calories smallint` + macros as `real`,
-- but the snapshot preserves the AI item's full fidelity, so macros are `numeric`
-- (matching the `user_saved_meal_items` child-table precedent, which also went
-- `numeric` for the same reason). `confidence` is `numeric` in [0,1], mirroring
-- the `AiLoggedItem.confidence` float the pipeline returns.

create table if not exists public.nutrition_entry_ingredients (
  id          uuid primary key default gen_random_uuid(),
  -- FK to the parent logged entry. ON DELETE CASCADE: when the meal log is
  -- deleted, its snapshot rows go with it (the snapshot is meaningless without
  -- the entry it describes).
  entry_id    uuid not null references public.nutrition_entries(id) on delete cascade,
  name        text not null,
  -- Per-item macro contribution, captured POST-scale (the value the user logged
  -- for this item). `numeric` preserves the AI item's fidelity vs the rounded
  -- entry columns. Non-negative — callers never persist negative nutrition.
  calories    numeric check (calories is null or calories >= 0),
  protein     numeric check (protein is null or protein >= 0),
  carbs       numeric check (carbs is null or carbs >= 0),
  fat         numeric check (fat is null or fat >= 0),
  fiber_g     numeric check (fiber_g is null or fiber_g >= 0),
  -- Match confidence in [0,1]; `< 0.5` is low-confidence (flagged, never dropped).
  -- Nullable: a missing confidence is treated as low downstream.
  confidence  numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  -- Provenance label — 'AI voice' / 'AI photo' (matches nutrition_entries.source).
  source      text,
  created_at  timestamptz not null default now()
);

-- Snapshot rows are read by entry_id (one batched `.in('entry_id', ids)` query
-- per macro-detail open), so index that lookup.
create index if not exists nutrition_entry_ingredients_entry_idx
  on public.nutrition_entry_ingredients (entry_id);

-- ── Row-level security ──────────────────────────────────────────────────────
-- User-owned, default-deny. Ownership is derived via the parent
-- `nutrition_entries` row's `user_id` (the EXACT pattern `user_saved_meal_items`
-- uses against `user_saved_meals`). Only SELECT + INSERT for the owner — no
-- UPDATE/DELETE policy: snapshots are immutable, and cascade handles delete.
alter table public.nutrition_entry_ingredients enable row level security;

-- Owner SELECT — a user can only read snapshot rows hanging off their own entry.
create policy "nutrition_entry_ingredients_owner_select"
  on public.nutrition_entry_ingredients for select
  to authenticated
  using (
    exists (
      select 1 from public.nutrition_entries e
      where e.id = nutrition_entry_ingredients.entry_id
        and e.user_id = (select auth.uid())
    )
  );

-- Owner INSERT — a user can only write snapshot rows for an entry they own.
create policy "nutrition_entry_ingredients_owner_insert"
  on public.nutrition_entry_ingredients for insert
  to authenticated
  with check (
    exists (
      select 1 from public.nutrition_entries e
      where e.id = nutrition_entry_ingredients.entry_id
        and e.user_id = (select auth.uid())
    )
  );

-- No UPDATE / DELETE policies: snapshots are immutable from the client, and the
-- parent FK ON DELETE CASCADE removes them when the entry is deleted.

comment on table public.nutrition_entry_ingredients is
  'ENG-751 — immutable per-item AI/photo/voice meal snapshot. One row per AI item; carries un-rounded macros + confidence + source dropped by the rounded nutrition_entries columns. Read by the "By ingredient" macro-detail view (gated by the nutrition_entry_ingredients_v1 display flag) to split AI meals into N lines.';

NOTIFY pgrst, 'reload schema';
