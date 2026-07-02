# Discover hero image fallback — design brief (D8, Option 2)

> Implemented 2026-04-21. Shared utility:
> `src/lib/recipe/recipeHeroFallback.ts`. Web renderer:
> `src/app/components/suppr/RecipeHeroFallback.tsx`. Mobile renderer:
> `apps/mobile/components/RecipeHeroFallback.tsx`. Wired into
> `apps/mobile/app/(tabs)/discover.tsx` and
> `src/app/components/DiscoverFeed.tsx` (desktop grid + mobile-web hero).
> Pinned by `tests/unit/recipeHeroFallback.test.ts`.
> Current `RecipeCard` type has no `tags` field, so v1 resolves cuisine
> off `title` only; §9 open question (server-side `cuisine_bucket`) still
> applies.
>
> **2026-05-26 (ENG-704):** the web Discover image element migrated from a
> raw `<img>` to `next/image` (`src/app/components/suppr/discover-recipe-image.tsx`).
> This gradient fallback is still the renderer for missing images AND for
> images that error at runtime (`onError → broken`). See
> `docs/decisions/2026-05-26-discover-image-next-image-optimizer-allowlist.md`
> for the optimizer-allowlist decision (why arbitrary user-imported image
> hosts render `unoptimized`).
>
> **2026-07-01 (ENG-1287, launch-blocker):** this fallback is now the
> app-wide null-image treatment for EVERY recipe card + thumbnail on both
> platforms. The data-layer fabrication that used to starve it — the mobile
> `pickDefaultImage` 6-photo Unsplash pool and web
> `DEFAULT_UPLOADED_RECIPE_IMAGE` — was deleted: a recipe with no image now
> carries `image: null` end-to-end, and Library (web + mobile
> `RecipeCardImage`), FeaturedHero/RecipeCardWide (web), profile grids,
> coach rows and the NorthStar card all render this fallback. Retired
> fabricated stock URLs (incl. rows RecipeUpload persisted to the DB) are
> blocklisted in `pickHeroImageUrl` via `RETIRED_STOCK_IMAGE_URLS`
> (`src/lib/recipes/heroImageFallback.ts`) and nulled at source by
> `supabase/migrations/20260702121000_eng1287_null_fabricated_recipe_stock_images.sql`.
> Decision record: `docs/decisions/2026-07-01-honest-recipe-imagery-eng1287.md`.

Target file: `apps/mobile/app/(tabs)/discover.tsx:224` (and the equivalent web Discover card when a recipe has no image).

## 1. Design intent

A recipe with no image should not read as broken. The current flat-tint placeholder with a `Utensils` glyph reads "prototype". Swap it for a deterministic, cuisine-aware gradient-plus-subtle-pattern fallback that looks intentional, never repeats identically in a row, and never fakes a photograph.

Constraints:
- In-house. No asset creation, no illustrations, no stock.
- Purely token-driven: gradients, a faint glyph mark, a subtle pattern overlay.
- Deterministic per recipe so the same recipe always shows the same fallback.

## 2. Structure

The fallback fills the existing 16:10 card hero region. Layers, bottom to top:

1. **Base gradient** — linear 135deg, two-stop, derived from cuisine/tag (see §3 spec).
2. **Pattern overlay** — a single repeating SVG pattern at 6% opacity, tiled. One of 4 patterns, picked by recipe id hash. Patterns: `dots`, `grid`, `chevron`, `circles`. Kept monochrome (white on dark gradient, black on light gradient).
3. **Centre glyph** — one lucide icon, 32px, at 55% opacity, white (because gradients are all mid-to-dark saturated). Glyph is cuisine-semantic: `Salad`, `Beef`, `Fish`, `Cookie`, `Soup`, `Wheat`, `Pizza`, `Utensils` fallback.
4. **Source badge** — existing, no change.
5. **Top-right fit-percent pill** — existing, no change (already overlays).

## 3. Gradient + glyph spec

Gradient is a two-stop 135deg linear in an OKLCH-adjacent space (use sRGB hex, the eye-mapping was done by hand for the 8 buckets below). Picked by cuisine tag; fallback to `default` when no cuisine is resolvable.

| Bucket key | Trigger tags (case-insensitive) | Gradient start | Gradient end | Glyph |
|---|---|---|---|---|
| greens | vegan, vegetarian, salad, bowl, green, kale, spinach | #5A8A60 | #2F5A3A | Salad |
| reds | beef, steak, bbq, grill, burger, chilli, pepperoni | #A24A3E | #5C2321 | Beef |
| blues | fish, seafood, tuna, salmon, prawn, pescatarian | #3C6A8F | #1E3A58 | Fish |
| warms | pasta, pizza, italian, tomato, mediterranean | #B8693A | #6A2F18 | Pizza |
| ambers | baked, dessert, cookie, cake, sweet, breakfast | #B08848 | #6A4820 | Cookie |
| earths | soup, stew, curry, broth, asian, noodle | #7A5A3A | #3A2A18 | Soup |
| neutrals | bread, grain, rice, oats, cereal, wheat | #7A6A4A | #3E342A | Wheat |
| default | any / unresolved | #4C6CE0 | #E04888 | Utensils |

Selection algorithm:
1. Lowercase + join all recipe tags + title.
2. For each bucket (in table order), test if any trigger string appears. First match wins.
3. If no match, use `default` (which is the brand gradient — Suppr's sanctioned gradient, acceptable on a non-photo fallback).

Pattern selection:
- Hash `recipe.id` with a fast hash (djb2 mod 4) → index into `[dots, grid, chevron, circles]`.

## 4. Pattern SVGs

All patterns tile at 24×24px, stroke or fill at `rgba(255,255,255,0.06)`. Keep them as raw SVG strings in a utility:

- `dots` — a single 1.5px circle centred in the tile.
- `grid` — 1px cross at tile centre (plus + sign).
- `chevron` — two 10px strokes forming a shallow V.
- `circles` — a 10px circle outline, 1px stroke, centred.

Patterns are always white-alpha. On the two lightest buckets (ambers, neutrals) the pattern is black-alpha at 6% instead — readability of the glyph is the constraint.

## 5. Interactions

Purely presentational. No tap target change. No animation on mount. No shimmer — this is the final state, not a loading skeleton.

## 6. States

- **Default** — as specified.
- **Loading** — existing loading skeleton for the card; fallback does not render until recipe data resolves.
- **Low data (recipe has id but no tags/title)** — use `default` gradient + `Utensils` glyph + `dots` pattern.
- **Real image available** — fallback not rendered; existing image path unchanged.

## 7. Cross-platform deviations

- Mobile: SVG pattern via `react-native-svg`'s `Pattern` + `Rect` fill, or a pre-rendered PNG tile bundled at 1× / 2× / 3× if SVG perf is an issue in lists. Prefer SVG; escalate only on frame-drop.
- Web: SVG `<pattern>` in an inline `<svg>`, or a CSS `background-image` data URL.
- Same 8 buckets, same hash algorithm on both platforms — identical fallback for the same recipe id.

## 8. Acceptance criteria

1. Same recipe id renders the same gradient + pattern + glyph on every render and across web + mobile.
2. No recipe ever falls through to a blank card — `default` bucket catches all.
3. Glyph contrast passes WCAG AA against the darker of the two gradient stops.
4. Row of 4 cards with different recipes must visibly vary (gradient OR pattern OR glyph differs). Verify with a screenshot test on a fixture of 12 tagless recipes.
5. No new assets committed; all patterns are inline SVG strings under 200 bytes each.
6. No network requests triggered by the fallback.
7. The existing fit-percent pill and source badge remain legible (contrast check against all 8 gradient end stops).

## 9. Open questions

- Does `Salad`, `Soup`, `Pizza` ship in lucide-react-native at the current pinned version? If `Soup` / `Pizza` missing, substitute `Utensils` and `UtensilsCrossed`.
- Should cuisine detection move to a server-side derived `cuisine_bucket` column for consistency across surfaces (Library, Plan meal rows)? Route to `nutrition-engine`. v1 can be client-side.
