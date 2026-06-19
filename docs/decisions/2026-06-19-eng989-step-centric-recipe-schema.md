# ENG-989 step-centric recipe schema

Date: 2026-06-19
Status: Resolved
Area: Schema refactor / recipes

## Decision

Use a relational step-centric model for recipes:

- `recipe_steps` stores ordered method rows (`recipe_id`, `position`, `text`).
- `recipe_ingredients.step_id` optionally links an ingredient row to the step that uses it.
- `recipes.instructions` remains during the deprecation window so current read paths and rollback remain safe.
- The legacy flat ingredient list is derived in application code by flattening step ingredients, deduplicating by normalized name, and dropping processed prep-state / optional serving-note rows.

## Why relational, not JSONB

The recipe verification and nutrition pipeline already depends on `recipe_ingredients` rows for ingredient IDs, verified macros, source metadata, overrides, and the `save_verified_ingredients` RPC. Storing step ingredients only as JSONB would orphan that pipeline and make nutrition totals harder to validate. A relational `recipe_steps` table preserves the existing ingredient row contract while adding the missing step linkage.

## Migration posture

The migration is additive only:

1. Create `recipe_steps` with public-read and owner-write RLS matching recipes/ingredients.
2. Add nullable `recipe_ingredients.step_id` with `on delete set null`.
3. Backfill `recipe_steps` by splitting existing `recipes.instructions` on newline boundaries.
4. Leave existing ingredients valid with `step_id = null` as the legacy/base/unassigned state.

Supabase MCP `apply_migration` must not be used for this committed migration. Grace should apply it with `supabase db push --linked`.

## Failure modes considered

- Existing instructions may be paragraph-style rather than one line per step. Splitting on newlines is intentionally conservative; it preserves current display order without pretending to infer semantic step boundaries.
- Ingredient-to-step attribution cannot be reconstructed for legacy rows. Keeping `step_id` nullable prevents false precision and allows old recipes to continue rendering from their flat ingredients.
- Duplicate derived ingredient rows can pollute shopping/nutrition views. The shared `flattenStepIngredients()` helper applies the same prep-state filters introduced by ENG-1136 before deduplication.
