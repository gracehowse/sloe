# Spec: Discover Phase 2 (B5)

**Date:** 2026-04-27
**Owner:** Engineering + Product
**Status:** Specced (post-launch v1.1+)
**Effort:** M (1–2 weeks, single-engineer push)
**Dep:** Phase 1 already shipped (creator follows live, save→library→plan loop wired via Library tab promotion 2026-04-26 round 1, 5-pill filters in `apps/mobile/app/(tabs)/discover.tsx`).

---

## Background

Discover Phase 1 covered the basics: a paginated feed with five quick-filter pills (For You, Popular, Quick, High Protein, Low Carb), creator follows, and the saves → library → plan loop. Phase 2 deepens the surface — creator profile pages and richer filtering — so Discover stops feeling like a flat feed and starts feeling like a place users return to.

## Goals

1. **Creator profile pages** at `/creator/[id]` (web) + `apps/mobile/app/creator/[id].tsx` so tapping a creator byline lands somewhere meaningful instead of just filtering the feed.
2. **Additional content-discovery filters** beyond the 5 pills — cuisine, cook-time, dietary-preset.
3. **A "saved creators" sub-tab** on Discover so users can browse content from creators they've explicitly followed.

## Non-goals

- Algorithmic For-You ranking changes. The current ranking is fine; Phase 2 is about surfacing.
- Creator-facing tooling (a "manage my profile" screen for creators). Creator content is curated server-side today; creator-facing CMS is a separate initiative.
- Paywalling Phase 2 features. Discover stays free across all tiers.

## Surfaces

### A. Creator profile page

Route shape:
- Web: `/creator/[id]`
- Mobile: `apps/mobile/app/creator/[id].tsx`

Page sections (top → bottom):

1. **Header**
   - Avatar (96pt) + Name + Handle (e.g. `@grace`).
   - Bio paragraph (≤ 240 chars). Editable server-side; falls back to "" when null — never a placeholder.
   - Follower count + Following count (tap-through to a follower / following list — Phase 2.5).
   - "Following" / "Follow" button (state-aware, optimistic, mirrors mobile pattern in `apps/mobile/components/CreatorFollowButton.tsx`).

2. **Stats row** (4 micro-tiles)
   - Recipes published (e.g. "27 recipes")
   - Total saves across their recipes (e.g. "1.2k saves")
   - Avg rating (placeholder — ratings are a separate initiative; show "—" until ratings ship).
   - Joined date ("Since Apr 2026").

3. **Recipe grid**
   - Same RecipeCard primitive used on Discover, paginated.
   - Default sort: most-recent. Secondary sort pill: "Popular" (saves desc).
   - Empty state: "No recipes yet" — never inflate with placeholders.

### B. Filter chips beyond the 5 pills

Current `apps/mobile/app/(tabs)/discover.tsx` has 5 pills. Phase 2 adds three filter dimensions, surfaced via a "Filters" sheet (tap "Filters" → bottom sheet on mobile, drawer on web):

| Dimension | Options | Source |
|---|---|---|
| Cuisine | Italian, Asian, Mediterranean, Mexican, Indian, American, Middle Eastern, Other | `recipes.cuisine` (column needs a CHECK constraint or enum migration if we want to enforce — currently freeform text) |
| Cook time | ≤15 min, ≤30 min, ≤45 min, ≤60 min, 60+ | `recipes.cook_time_minutes` (already populated on imports) |
| Dietary preset | Vegan, Vegetarian, Gluten-free, Dairy-free, High-protein, Keto, Paleo, Low-FODMAP | derive from `recipes.tags` + `dietary_flags` JSONB |

Pills + filter sheet are independent: the 5 quick-pills stay (they're the default lens); the sheet is additive — applied filters render as chips above the feed with an "x" to remove. URL state `?cuisine=italian&time=30&diet=high-protein` is shareable.

### C. Saved creators sub-tab

On Discover, between the existing "For You" / "Popular" header and the recipe grid, add a tab strip:
```
[ Discover ]  [ Following ]
```

The "Following" tab fetches `recipes` filtered to `creator_id IN (SELECT followee_id FROM creator_follows WHERE follower_id = current_user)`, sorted by `published_at DESC`. Empty state copy: "Follow creators on their profile pages to see their new recipes here."

Phase 2.5 (out of scope here): push notifications when a followed creator publishes — already plumbed via expo + web-push primitives, just no trigger yet.

## Implementation sketch

### Migration

```sql
-- B5 — Discover Phase 2 additions
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS cuisine text,
  ADD COLUMN IF NOT EXISTS dietary_flags jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON public.recipes (cuisine);
CREATE INDEX IF NOT EXISTS idx_recipes_cook_time ON public.recipes (cook_time_minutes);

-- creator_follows table is already live (verified 2026-04-26 in
-- 20260503101000_schema_drift_repair.sql).
```

### Library

`src/lib/discover/filterRecipes.ts` (new) — pure function that takes a base query + a `Filters` object + paginates. Reused by web + mobile so the filter semantics are byte-identical.

### Web

- `src/app/creator/[id]/page.tsx` — server-side render of creator profile.
- `src/app/components/discover/FilterSheet.tsx` — drawer on `lg:`, bottom sheet on phones.
- `src/app/components/discover/Discover.tsx` — extended with tab strip + filter chip rendering.

### Mobile

- `apps/mobile/app/creator/[id].tsx` — Expo Router dynamic route.
- `apps/mobile/components/discover/FilterSheet.tsx` — RN bottom sheet (`@gorhom/bottom-sheet` already in deps).
- `apps/mobile/app/(tabs)/discover.tsx` — extended (don't fork; minimal diff).

## Tests

- `tests/unit/filterRecipes.test.ts` (web + mobile shared) — pin filter combinatorics: cuisine + time + diet AND together; empty filters → unchanged base query; multi-value cuisines → IN.
- `tests/unit/creatorProfilePage.test.tsx` (web) — render with seeded creator; assert recipe grid + follow button + empty state.
- `apps/mobile/tests/unit/creatorProfileScreen.test.tsx` — mobile parallel.
- `tests/unit/discoverFollowingTab.test.tsx` — assert "Following" tab fetches the right filtered recipe set.

## Acceptance criteria

1. Tap a creator byline anywhere on Discover or Recipe Detail → land on the creator profile page (web + mobile).
2. Tapping "Filters" opens the sheet; selecting any filter dimension applies it; chips render above the feed; tapping the "x" on a chip clears that dimension.
3. URL state on web mirrors the applied filters (`/discover?cuisine=italian&time=30`); deep-linking with that URL renders the filtered view directly.
4. The "Following" tab on Discover surfaces only recipes from followed creators, sorted by recency. Empty state is honest when zero recipes exist.
5. `npm run ci` green; mobile + web typecheck + vitest.
6. PostHog: new event `discover_filter_applied { dimension, value }` fires when filters land.

## Phasing

- **Phase 2a (3-4 days)** — creator profile page (web + mobile). Most-loved feature in tester feedback; shipping it solo unblocks the byline-link UX.
- **Phase 2b (3-4 days)** — filter sheet + chip rendering. Migration + library + UI in one push.
- **Phase 2c (1-2 days)** — Following sub-tab. Smallest piece; safe to ship last.

## Risks

- **Cuisine column is freeform.** Existing rows use whatever the import picked up from the source. The filter pill set (Italian, Asian, …) needs a normalisation step — at write-time on imports, plus a one-off backfill of existing rows. Without that, the filter sheet will surface partial / inconsistent options. Mitigation: a small `NORMALIZE_CUISINE` lookup table in `src/lib/recipes/normalizeCuisine.ts`; backfill via a one-time script.
- **Dietary flags are derived, not stored.** Today we infer "high-protein" / "vegan" from `recipes.tags` at render time. Phase 2 should persist these as `recipes.dietary_flags` JSONB so the filter is fast — backfill from existing tag arrays.
- **Following tab on a brand-new account.** Empty state must be helpful, not bleak. Copy: "Follow creators on their profile pages to see their new recipes here." + a "Browse popular creators" link to a curated list. Curated list TBD — Phase 2.5.

## Cross-platform parity

Phase 2a, 2b, 2c each ship web ↔ mobile in lockstep. The shared `src/lib/discover/filterRecipes.ts` is the parity contract — both platforms read from it.
