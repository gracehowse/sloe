# Recipe + ingredient image system (Sloe imagery, runtime + backfill)

- **Date:** 2026-06-08
- **Area:** Recipes — imagery (web + mobile); nutrition pipeline (display only)
- **Status:** Resolved — implemented + backfilled (fal.ai funded 2026-06-08); hero cooked-state fix
  applied + heroes regenerated 2026-06-08; **canonical-key re-key + Nano Banana Pro ingredient re-shoot
  + lazy generate-on-miss shipped 2026-06-08** (see "Canonical key + Nano + lazy generation (2026-06-08)"
  below — the Template-B engine change awaits `brand-manager` ratification, tracked ENG-905). Builds on
  the ratified [image-generation strategy](2026-06-03-image-generation-strategy.md) and the LOCKED
  [Sloe image prompt template](../brand/sloe-image-prompt-template.md).

## Context

Recipe heroes and ingredient tiles fell back to the deterministic cuisine-gradient glyph
(`recipeHeroFallback.ts`). The 2026-06-03 strategy ratified generating real, on-brand Sloe imagery
(FLUX 2 Pro via fal.ai). The backend was built ahead of funding and degraded gracefully while fal
was out of balance; this doc records the system as shipped once fal was topped up and the backfill
ran.

## What the system is

Two image classes, both generated from the LOCKED brand template, stored in Supabase Storage
(`recipe-images` bucket, public), served as plain URLs:

1. **Recipe heroes (Template A — finished dish).** Generated per recipe and written to
   `recipes.image_url`. The existing hero render ladder (`pickHeroImageUrl`) already prefers
   `image_url`, so no render change was needed — populating `image_url` is sufficient. Web in-app
   (`RecipeDetail.tsx`), mobile (`RecipeDetailHero`), and Library/Discover cards all pick it up.

2. **Ingredient tiles (Template B — single ingredient on white).** Global, deterministic, keyed by
   `normalizeIngredientNameKey(name)` in the new `ingredient_images` table (one row per distinct
   canonical ingredient; public read; service-role write). Reused everywhere an ingredient appears.

## Decisions

1. **`ingredient_images` is GLOBAL + public-read, service-role-write.** Matches the foods /
   food_sources public-lookup pattern. Clients never write; the backfill script + the runtime
   generator (service key) own writes. Migration: `supabase/migrations/20260608120000_ingredient_images.sql`
   (applied via `supabase db push --linked` 2026-06-08; never MCP `apply_migration`).

2. **Key = `canonicalImageKey(name)`, used identically at write-time and read-time** (updated 2026-06-08
   from `normalizeIngredientNameKey`). The backfill keys rows by it and the grids hydrate by it
   (`fetchIngredientImages` → `resolveIngredientTileImage`). The key function MUST match on both sides or
   lookups miss — enforced by the mandatory guard test `tests/unit/canonicalImageKey.test.ts`
   (writer-key == reader-key across the real corpus + idempotency). `canonicalImageKey` strips leading
   quantities + brand prefixes (fixing the "120g spinach" / "spinach" dup-tile bug) and applies a curated
   image-key granularity policy. See "Canonical key + Nano + lazy generation (2026-06-08)" below.

3. **Clean display name is DISPLAY-ONLY.** Tiles + labels use `cleanIngredientDisplayName(name)`;
   this is NEVER fed back into nutrition matching, verification, or the `recipe_ingredients.name`
   write path. The raw name stays the source of truth for nutrition. (Reinforced in the helper's
   own docblock + `cleanIngredientDisplayName.test.ts`.)

4. **Fallback is a calm cream tile, never the loud gradient and never an empty box.** When no
   `ready` image exists, `getIngredientTilePlaceholder` renders a warm cream tile (`#F1EFE8` /
   `#ECEAE1`) with the ingredient's initial in sage `#7C8466` (§11.4). Deterministic per name.

5. **Graceful degradation is load-bearing.** `fetchIngredientImageMap` returns an empty map (→
   placeholders) on any error (table missing, RLS, network, throw) and never throws on the recipe
   screen. The generator (`falImageGenerator.ts`) and the `/api/recipe-import/image-hero` route
   return typed errors / `{ skipped }` and never crash or block a save. A decorative tile is never
   worth a thrown error.

6. **Backfill is idempotent + bounded.** `scripts/backfill-images.ts` is dry-run by default
   (`--apply` to write), skips recipes with a non-placeholder `image_url`, skips ingredient keys
   already `ready`, retries `pending`/`failed`, and rate-limits (1.2 s/req). `--heroes-only` /
   `--ingredients-only` / `--limit N` scope it.

## Brand validation (SEE, don't orchestrate)

Per the strategy doc's "render ~10 real outputs and eyeball vs the checklist before trusting it":
8 generated images were downloaded + read against the prompt-doc §8 reviewer checklist before the
display was trusted — 4 heroes (porridge, frittata, meatballs, ingredient-derived "Imported
recipe") + 4 ingredients (shrimp, eggs, cherry tomatoes, honey). All passed: photographic, on-brand
(Template A moody editorial; Template B clean white background), no text/people/watermark,
appetising, anatomically sane. Verdict: the LOCKED prompt produces correct Sloe imagery.

## Backfill result (2026-06-08)

- Heroes: **6/6** recipes that lacked a real image generated (2 recipes kept their existing
  non-placeholder image — correctly skipped). Transient fal 403s during the run were retried to
  success by the idempotent re-run.
- Ingredients: **51/51** distinct canonical keys `ready` (0 failed/pending after the retry pass).

## Hero cooked-state fix + regeneration (2026-06-08)

**Bug.** The first hero batch rendered RAW ingredients sitting on top of the cooked dish — the
frittata had whole raw eggs on it, the protein oats had loose powder heaped on top. Root cause: the
Template-A prompt listed the recipe's raw ingredients verbatim (`…a finished plated dish featuring
eggs, protein powder, spinach…`); FLUX-2-pro follows the positive prompt literally, so it depicted
the ingredients as-bought. The original brand validation above MISSED this (it read "All passed"
including the frittata) — a thumbnail eyeball is not a forensic read.

**Fix (proven via fal before the code change).** Stop listing raw ingredients. Two parts:
1. **LLM dish-appearance step** — new [`src/lib/server/llmDishAppearance.ts`](../../src/lib/server/llmDishAppearance.ts)
   (`describeDishAppearance`) asks the shared server LLM (Haiku / `gpt-4o-mini`, low temp, ≤160
   tokens) for one-to-two sentences describing the FINISHED, cooked, plated dish — eggs set, powder
   dissolved, batter baked — naming only ingredients visible when served. Fail-safe: any LLM failure
   falls back to a generic "fully cooked and plated… nothing raw on the surface" clause; generation
   is never blocked. The key ingredients now inform the LLM only — they are no longer listed verbatim
   in the FLUX prompt.
2. **Cooked-state guards** folded into the Template-A positive prompt (`buildDishPrompt` in
   [`falImageGenerator.ts`](../../src/lib/server/falImageGenerator.ts)): "fully cooked and integrated…
   no raw or uncooked ingredients, no whole raw eggs, no runny yolks on top, no loose or dry powder,
   nothing raw piled on the surface. No people, no hands, no fingers. No text, no logo, no watermark."

**Regeneration.** Added `--regenerate-heroes` to `scripts/backfill-images.ts` — force-overwrites the
existing AI-generated heroes (those under the `recipe-images/heroes/` storage path) while NEVER
touching real imported/external covers (e.g. Instagram CDN), which aren't under that path. Ran
`--apply --heroes-only --regenerate-heroes`: **6/6** heroes regenerated, 0 failed; the 2 imported
Instagram covers (Shrimp Rice Paper Rolls, Homemade Cream Cheese) correctly left untouched.

**Re-verification (forensic, per-image — not a thumbnail glance).** All 6 downloaded + Read against
5 checks: (a) no raw/uncooked on top, (b) no whole raw eggs / runny yolks, (c) no loose powder, (d)
no hands/people, (e) on-brand. **All 6 passed**, including the two that previously failed:

| Hero | raw on top | raw eggs | loose powder | hands/people | on-brand | Verdict |
|---|---|---|---|---|---|---|
| Chicken Frittata | none | none — eggs SET | none | none | yes | PASS |
| Protein Overnight Oats | none | n/a | none — powder DISSOLVED | none | yes | PASS |
| Pear and cinnamon porridge | none | n/a | none (cinnamon = garnish) | none | yes | PASS |
| Italian Potato Salad | none | n/a | none | none | yes | PASS |
| Chicken Meatballs with Orzo | none | n/a | none | none | yes | PASS |
| Imported recipe | none | none — egg bake SET | none (ricotta dollops, not powder) | none | yes | PASS |

**Doc:** Template A in [`../brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md)
updated to the LLM-description + cooked-state-guards pattern, flagged for `brand-manager` ratification
(LOCKED-artefact change).

## Canonical key + Nano + lazy generation (2026-06-08)

Three changes shipped together to fix the two open follow-ups (key drift / quantity pollution + the
inconsistent FLUX ingredient set) and add the self-growing library.

### 1. Canonical image key — `src/lib/recipe/canonicalImageKey.ts` (NEW, single source of truth)

`ingredient_images.name_key` is now `canonicalImageKey(name)`, used IDENTICALLY by the backfill writer
(`scripts/backfill-images.ts`) and every display reader (`ingredientImageTile.ts` `resolveIngredientTileImage`
+ `ingredientImages.ts` `fetchIngredientImages`, web + mobile via `@suppr/shared`). The prior key
(`normalizeIngredientNameKey`) did not strip leading quantities, so "120g spinach" / "spinach" got two
tiles, and three Fage/Waitrose Greek-yogurt brand forms got three. A **mandatory guard test**
(`tests/unit/canonicalImageKey.test.ts`) asserts writer-key == reader-key across the real 51-string
corpus + idempotency, so the key can never silently drift again.

- **Hybrid:** text spine (`deriveTextKey`) is ALWAYS the key (the matched-food id is null across the whole
  seed corpus). It reuses `cleanIngredientDisplayName`'s brand/quantity/parenthetical strip spine (those
  helpers are now exported), plus an image-key-specific regional + identity-collapse alias map (curated —
  deliberately NOT the nutrition `NAME_ALIASES`, which expands single words to USDA strings like
  "egg"→"egg whole raw" and would break grouping). `applyNameAliases` in `verifyIngredients.ts` is
  **untouched**, as is `src/lib/planning/ingredientNameKey.ts` (shopping/plan still key by it).
- **Granularity (image key only — raw/cooked do NOT split):** DISTINCT — egg ≠ egg white ≠ egg yolk;
  milk ≠ oat ≠ almond; chicken breast ≠ thigh ≠ ground; cherry tomato ≠ tomato ≠ paste ≠ sauce; each
  cheese; sugars; onions; rice. COLLAPSE — all salt → `salt`; olive-oil grades → `olive oil`; herb preps
  → the herb; meat mince → `ground X`; regional synonyms (courgette→zucchini, prawns→shrimp,
  coriander→cilantro). Real corpus: **51 raw names → 43 canonical keys** (down from 51 polluted keys).
- **Matched-food alias** (`matchedAliasKey`, `confidence ≥ 0.85`) is computed + wired through the input
  type but NOT folded into the key (a weak match can never corrupt grouping). v1 has no alias storage —
  fast-follow ENG-905.

### 2. Ingredient engine → Nano Banana Pro (Template B)

`generateIngredientImage` switched FLUX 2 Pro → `fal-ai/nano-banana-pro` (Google Gemini 3 Pro Image) with
a FIXED `system_prompt` (the consistency lever — identical lighting/scale/shadow on every call) + a FIXED
`seed: 424242`, `aspect_ratio: "1:1"`, `resolution: "2K"`, `output_format: "jpeg"`. The per-image prompt
is reduced to the ONE representative subject (`A single {x}.`; loose foods → `A small neat mound of {x}.`;
liquids → `A small unlabelled portion of {x} …`) — **never the literal recipe quantity**. This fixes the
FLUX ingredient drift (pile-vs-bowl, "4 eggs" for one ingredient, egg-white-rendered-as-a-milk-bottle).
**Template A (dish heroes) is UNCHANGED — still FLUX 2 Pro.** The LOCKED template (§2) is updated with a
PENDING-`brand-manager`-sign-off banner (ENG-905).

### 3. Lazy generate-on-miss + cache (the library grows itself)

`fetchIngredientImages` now returns `{ map, missingKeys }`; the display layer (web `RecipeDetail.tsx` +
mobile `recipe/[id].tsx`, via the shared `enqueueIngredientImages` helper) fires
`POST /api/ingredient-image` for any canonical key with no `ready` image. The endpoint idempotently claims
each key `pending` via an atomic `insert … on conflict do nothing` (so two devices / two rows for the same
ingredient never double-spend fal), generates with Nano, and caches `ready`. **Never blocks render**
(fire-and-forget; the screen re-hydrates on its next load), **never regenerates an existing key**, and
degrades to the calm placeholder on any fal/DB error. Per-user rate-limited; capped at 6 keys/request.
The candidate-selection logic is extracted to a pure, unit-tested helper
(`src/lib/recipe/ingredientImageQueue.ts`).

### Re-key + regeneration run (2026-06-08)

Ran `backfill-images.ts --apply --ingredients-only --regenerate-ingredients` (new force flag) to re-key +
re-shoot the WHOLE ingredient library on Nano: **43/43 canonical keys regenerated** (overwriting the old
inconsistent FLUX tiles). Old-key orphan rows (the 51 − matched pre-existing keys) deleted post-run.
Forensic per-image verification of a ~15-image sample (incl. egg, egg white, oat/almond, chicken cuts,
cherry tomato, salt, a leafy green, a branded sauce) + a stitched set-consistency strip: see the
implementing session report.

## Display wiring (web + mobile parity)

- **Web** `src/app/components/RecipeDetail.tsx`: load effect hydrates the image map; each ingredient
  tile shows the photo (`<img>`) or the cream placeholder; label = clean display name.
- **Mobile** `apps/mobile/components/recipe/RecipeIngredientGrid.tsx` (+ screen
  `apps/mobile/app/recipe/[id].tsx` which hydrates the map and passes it down): identical contract
  via `<Image>` / cream placeholder.
- **Heroes + Library cards**: unchanged render — already read `image_url`; the calm cream fallback
  (post-2026-06-08 `recipeHeroFallback` reskin) is the no-image state. The verdict chip is the sage
  "Fits your day" chip (unchanged by this work — already shipped in the frame rebuild).

## Follow-ups (tracked, not silent)

- **`brand-manager` ratification of the Template-A cooked-state change AND the Template-B Nano switch**
  (ENG-905). Two LOCKED-artefact changes shipped code-first (proven via fal): (a) the §1 hero
  cooked-state fix (LLM dish description + cooked-state guards, replacing the raw `featuring {ingredients}`
  clause) and (b) the §2 ingredient ENGINE move FLUX → Nano Banana Pro + the FIXED `system_prompt`/seed.
  Both prompt-doc sections carry a PENDING-SIGN-OFF banner. `brand-manager` to formally ratify both and
  record in `docs/decisions/`.
- **Matched-food-name persistence + alias storage** (ENG-905, fast-follow). Two related gaps: (1) the
  tile label should *prefer the matched food name* (e.g. the FatSecret match's name) but
  `recipe_ingredients` has no `matched_food_name` column — v1 uses `cleanIngredientDisplayName(name)` (the
  spec's documented fallback), correct but not the matched name; (2) `canonicalImageKey` computes a
  high-confidence `matchedAliasKey(source, food_id)` but there is no alias storage
  (`ingredient_image_aliases` / `ingredient_images.matched_*` columns) — so a differently-spelled future
  ingredient that matched the SAME food doesn't yet share a tile via the alias path (it still shares via
  the text key when those converge). Both need a deliberate schema + persistence change; the matched id is
  null across the whole seed corpus today, so neither fires yet.
- **~~Ingredient-key quantity pollution~~ — RESOLVED 2026-06-08.** `canonicalImageKey` strips leading
  quantities + brand prefixes at write + read (51 raw → 43 keys), guarded by
  `tests/unit/canonicalImageKey.test.ts`.
- **Branded-product tiles + pseudo-label text.** The Nano `system_prompt` explicitly forbids text/labels
  (a true Gemini-3 system instruction, stronger than FLUX's positive avoid-clause). Re-verify the branded
  items (protein supplement, chili crisp, dark chocolate) in the post-regeneration sample; if any still
  show faint pseudo-text, note it in the verification table. Whole-food tiles are clean.
- **webp transcode.** Generated images are stored as JPEG (Nano emits jpeg/png, not webp). A storage-layer
  transcode-to-webp is a future optimisation, not a blocker (see `falImageGenerator` docblock).

## Related

- Strategy: [`2026-06-03-image-generation-strategy.md`](2026-06-03-image-generation-strategy.md)
- Prompt template (LOCKED): [`../brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md)
- Universal food imagery (marketing/social adoption): [`2026-06-07-universal-food-imagery.md`](2026-06-07-universal-food-imagery.md)
- Superseded hero-fallback auto-gen fragment: [`2026-05-11-hero-fallback-auto-gen.md`](2026-05-11-hero-fallback-auto-gen.md)
