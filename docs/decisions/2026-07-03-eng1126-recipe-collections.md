# ENG-1126 recipe collections (folders)

Date: 2026-07-03

## Decision

Ship user-created recipe collections (Paprika/Plan to Eat-style folders) as a flag-gated (`recipe_collections_v1`) cross-platform feature:

- New tables `recipe_collections` (one row per named collection) and `recipe_collection_items` (a recipe → collection junction, many-to-many).
- One shared, pure CRUD module (`src/lib/recipes/recipeCollections.ts`, imported by mobile as `@suppr/shared/recipes/recipeCollections`) that both web and mobile call directly — not two hand-mirrored implementations.
- Web: a `LibraryCollectionsBar` pill row (matches the existing category/provenance pill grammar) plus a per-card `AddToCollectionMenu` checklist popover.
- Mobile: a `RecipeCollectionsBar` pill row plus a per-card `AddToCollectionSheet` bottom sheet, wired through a new `useRecipeCollections` hook in `apps/mobile/lib/recipes.ts`.
- Collection filtering is orthogonal to the existing category/entry-kind filters — it layers on top, it doesn't replace them.

**Pro-gating on collection creation is explicitly deferred, not decided.** The ticket's own dependency note flagged this as an open monetisation question. This ship makes collections available to all tiers; a follow-up ticket should route the "should collection count/creation be tier-gated" call through `monetisation-architect` before any gate is added. Building the gate speculatively here would be guessing at a pricing decision nobody has made.

## Rationale

**One shared module, not parallel implementations.** The ticket's literal wording ("keep the saves/collection logic structurally parallel") could be read as "write two hand-mirrored functions, one per platform" — the older pattern `toggleSaveRecipe` uses. `persistImportedRecipe.ts` already established a stronger pattern for this codebase: a pure `async function(supabase: SupabaseClient, ...)` that both platforms import and call directly, guaranteeing zero query-logic drift between web and mobile. Collections use that pattern instead — it still fully honors the ticket's underlying intent (parity, no drift) with a better mechanism.

**Recursion-safe RLS.** `recipe_collection_items` is a child table whose RLS policies need to check ownership of the parent `recipe_collections` row. Subquerying the parent table directly from the child's own policy is the exact recursion hazard this codebase has hit twice before (`20260423110000_household_rls_recursion_fix.sql`, `20260520100000_saves_rls_recursion_fix.sql`). The migration adds a `security definer stable` helper, `public.auth_owns_collection(p_collection_id uuid)`, that bypasses RLS internally and is referenced from the child policies instead.

**Graceful degradation, not a hard dependency on the migration being live.** The migration is staged (`supabase/migrations/20260703140000_eng1126_recipe_collections.sql`) but has not been applied to any environment yet, per this repo's rule that migrations are staged and applied by Grace via `supabase db push --linked`, never via MCP `apply_migration`. Both platforms probe the table on load and set a local `enabled`/`dbCollectionsEnabled` flag; when the table is missing, the UI simply doesn't create/query collections rather than throwing. This was verified live in the browser preview: attempting to create a collection against the unmigrated dev DB surfaces the exact expected toast — `Could not find the table 'public.recipe_collections' in the schema cache` — with no console error and no crash.

**Screen-line-budget compliance.** Both `src/app/components/Library.tsx` (pinned 695) and `apps/mobile/app/(tabs)/library.tsx` (pinned 1156) were already at their only-shrink screen-budget pins with zero slack. On both platforms the bookmark + draft-badge card overlay cluster was extracted into its own component (`RecipeCardOverlayControls.tsx`, web and mobile versions) to make room for the new collection affordance without growing the host screen past its pin — a genuine architectural extraction (the cluster was already complex enough to warrant its own component), not a budget-gaming move.

## Verification

- `npm run check:migrations -- --static` — 172 migration files, all well-formed and unique.
- Web: `npm run typecheck`, `npm run check:screen-budget`, `npm run check:token-scale`, `npm run check:spacing-scale` all clean; `Library.tsx` at 686 lines (under its 695 pin).
- Mobile: `npm run mobile:typecheck`, `npm run mobile:lint` (0 errors) clean; `apps/mobile/app/(tabs)/library.tsx` at 1155 lines (under its 1156 pin).
- Unit tests: `tests/unit/recipeCollections.test.ts` (16 tests, the shared CRUD module) and `apps/mobile/tests/unit/useRecipeCollections.test.tsx` (5 tests, mobile-hook-specific optimistic-update/rollback + silent-disable-on-missing-table behaviour).
- Live browser verification (web, data-rich test account): signed in, saved a Discover recipe to populate the Library (the account had zero library recipes, correctly triggering the existing ENG-100/ENG-1313 empty-library → Discover redirect), confirmed the `+ New collection` affordance renders on the Cookbook tab, and confirmed the create-collection attempt against the unmigrated dev DB degrades to the expected toast with no crash.
- Mobile UI (`RecipeCollectionsBar`, `AddToCollectionSheet`, `RecipeCardOverlayControls`) was verified via typecheck/lint/tests only — not yet visually confirmed in the iOS simulator. Flag defaults off (`recipe_collections_v1`), so this ships dark pending a simulator pass.

## Apply and verify (Grace)

Apply the staged migration with `supabase db push --linked` — never MCP `apply_migration` or Dashboard "Save as migration" (timestamp drift risk). After applying:

```sql
select relrowsecurity from pg_class where relname in ('recipe_collections', 'recipe_collection_items');
select prosecdef, proconfig from pg_proc where proname = 'auth_owns_collection';
```

Expected: `relrowsecurity = true` on both tables; `prosecdef = true` and `proconfig` includes `search_path=public` on the helper function. Ramp `recipe_collections_v1` via the PostHog dashboard once confirmed.
