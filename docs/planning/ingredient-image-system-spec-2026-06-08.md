# Ingredient-image system — build spec (2026-06-08)

Executor-ready. Source: nutrition-engine canonical-key design + ingredient-display research + Grace's direction (consistent generated photo per canonical food, lazy-generate-on-miss + cache, Lose-It-style visual+match split).

## Goal
One **consistent, signature-style photo per canonical food**, reused across every recipe. The tile shows the photo (recognition/aesthetic) + the **specific matched ingredient** as text (accuracy). Library grows itself: a new ingredient generates once in the house style, then is cached + reused forever.

## 1. Canonical image key — `src/lib/recipe/canonicalImageKey.ts` (NEW, single source of truth)
Used IDENTICALLY by the backfill writer AND every display reader (the prior bug was write/read key drift). Pure + sync, safe in render.

```ts
export interface CanonicalImageKeyInput {
  name: string;                 // raw recipe_ingredients.name (always present)
  matchedSource?: string | null;  // recipe_ingredients.source
  matchedFoodId?: string | null;  // recipe_ingredients.fatsecret_food_id (holds the matched id)
  confidence?: number | null;     // recipe_ingredients.confidence
}
export function canonicalImageKey(input: CanonicalImageKeyInput): string;
```

**Derivation (hybrid — text spine, matched-food as upgrade):**
- `base = deriveTextKey(name)` (rules below) → this is ALWAYS the key (guarantees every row gets one; the matched id is null across the whole seed corpus today).
- Matched-food identity is an **optional alias** only when `confidence ≥ 0.85` — record `(source, food_id) → name_key` so a differently-spelled future ingredient that matched the SAME food reuses the tile. NEVER key off a weak match (CLAUDE.md: reject low-confidence collapses).

**`deriveTextKey` pipeline (reuse `cleanIngredientDisplayName`'s strip spine; output lowercase):**
1. Strip section tags `[Marinade]`/`[Sauce]`/`[Crumble]` → `/\s*\[[^\]]*\]\s*/g`
2. Strip brand prefix before `·`/`|`/` - ` (reuse `stripBrandPrefix`)
3. Strip leading quantity+unit (reuse `LEADING_QTY_RE` — THIS fixes "4 large eggs"→egg)
4. Strip trailing measure noise (`15-oz can`, `20-oz bag`, trailing `can|jar|tin|pack|box`)
5. Strip all parentheticals `/\([^)]*\)/g` (minced/drained/sliced…)
6. Resolve "X or Y" → take the ingredient-y branch (mirror `orSplit`)
7. Strip leading non-identity descriptors (fresh/ripe/large/organic/chopped/…) — but KEEP identity modifiers (ground/smoked/shredded/whole/skinless on meat/dairy)
8. Apply regional-synonym aliases (reuse `applyNameAliases`: courgette→zucchini, prawns→shrimp, coriander→cilantro)
9. Singularise (`stem()` / trailing-s)
10. Collapse whitespace, lowercase, trim → `name_key`

## 2. Granularity policy (image key only — raw/cooked do NOT split)
- **DISTINCT:** egg ≠ egg white ≠ egg yolk; dairy milk ≠ oat ≠ almond; chicken breast ≠ thigh ≠ ground chicken; cherry tomato ≠ tomato ≠ canned tomato ≠ tomato paste ≠ tomato sauce ≠ sun-dried; brown sugar ≠ sugar ≠ powdered sugar; red onion ≠ yellow onion ≠ scallion ≠ shallot; brown rice ≠ white rice; each cheese (parmesan/mozzarella/feta/cheddar/cottage/cream) distinct.
- **COLLAPSE:** all salt (fine/kosher/sea/flaky → `salt`); white-rice varieties (jasmine/basmati/arborio… → `white rice`, but arborio may stay for risotto); olive-oil grades → `olive oil`; herb preps (fresh thyme/thyme leaves → `thyme`); broths → `broth` (borderline — invisible difference).
- **Rule:** share a tile only if a reasonable person wouldn't notice the photo is of the other one. When unsure, keep distinct (a too-specific image is safe; a wrong one is a bug).
- **Raw/cooked do NOT split the IMAGE key** (a grain of rice looks like rice either way) — document so no one "fixes" it.

## 3. Template B — STRICT consistency (fixes Grace's pile-vs-bowl/bg/quantity drift)
Generate ONE representative, identical treatment every time:
- A single [canonical food], ONE item (one egg, one tomato), on a **pure white seamless background**, soft even studio daylight, a soft shadow directly beneath, sharp focus, true-to-life colour, centred, 1:1. No bowl, no spoon, no props, no scenery, no piles, no text/label, no hands. Sloe house style (the Stitch eggs/`allergen-eggs.png` look is the reference).
- For inherently-loose items (salt, pepper, oregano, flour): a **small neat mound** of it on pure white — ONE consistent treatment for all loose items (not bowl-for-one, pile-for-another).
- For liquids/condiments (oil, soy, honey): a small clean pour/portion or a simple unlabelled vessel, consistent per class.
- Pin a fixed seed per house-style for reproducibility.

## 4. Lazy generation + cache (Grace's core idea)
- Pre-seed the ~130 canonical keys from the current corpus (backfill).
- On display: resolve `canonicalImageKey`; if a `ready` row exists → show it; else show the calm cream placeholder AND enqueue generation (idempotent, deduped by key); cache to `ingredient_images` when ready → every future use reuses it. The library grows itself.
- Never block render on generation; never regenerate an existing key.

## 5. Two-layer tile (keep the Figma grid; make the match accessible)
- Visual = `canonicalImageKey` photo (consistent), else cream placeholder.
- Primary text = the matched/cleaned ingredient name (the specific food — "Egg White", "Black Bean & Red Pepper Sauce"), NOT raw import junk. Prefer the matched food name where available; else `cleanIngredientDisplayName`.
- Amount + per-ingredient kcal; confidence dot; tap → change-match sheet (preserve the existing Verify/Fix path).
- (Fast-follow) "Edit image" affordance like Lose It's Edit Icon: tap → swap/pick the tile image.

## 6. Wiring + tests
- Repoint writer `scripts/backfill-images.ts` (key call ~line 215) + readers `src/lib/recipe/ingredientImageTile.ts` + `ingredientImages.ts` (web + mobile via `@suppr/shared`) to `canonicalImageKey`.
- **Leave `src/lib/planning/ingredientNameKey.ts` UNTOUCHED** (shopping/plan still use it).
- Optional alias schema: `ingredient_images.matched_source/matched_food_id` + `ingredient_image_aliases(source, food_id, name_key)`. Ship text-only path first; alias is a fast-follow.
- One-time re-key of the existing 51 rows (re-run backfill with the new key; orphan-clean old keys).
- **MANDATORY guard test** (mirror `tests/unit/ingredientImageTile.test.ts`): writer key == reader key for ~40 real corpus strings; `canonicalImageKey` idempotent + stable.

## 7. Verify (orchestrator owns this)
After regeneration: download + Read EVERY image; check each for: single representative item (not literal quantity), pure-white consistent background, consistent treatment (no bowl-vs-pile drift), recognisably-correct food (egg-white ≠ milk bottle), no text/hands. The prior backfill's self-check missed errors — verify per-image, don't trust the agent.

## Library size
~110–140 distinct canonical keys for the current ~600-row seed corpus. Budget ~130–160 generations. Grows slowly (long-tail aromatics repeat).
