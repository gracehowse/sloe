# Recipe + ingredient image system (Sloe imagery, runtime + backfill)

- **Date:** 2026-06-08
- **Area:** Recipes — imagery (web + mobile); nutrition pipeline (display only)
- **Status:** Resolved — implemented + backfilled (fal.ai funded 2026-06-08); hero cooked-state fix
  applied + heroes regenerated 2026-06-08 (see "Hero cooked-state fix" below — the LOCKED-template
  change awaits `brand-manager` ratification; Linear issue to be opened for the ratification +
  follow-ups). Builds on the ratified
  [image-generation strategy](2026-06-03-image-generation-strategy.md) and the LOCKED
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

2. **Key = `normalizeIngredientNameKey(name)`, used identically at write-time and read-time.** The
   backfill keys rows by it and the grids hydrate by it (`fetchIngredientImageMap` →
   `resolveIngredientTileImage`). The key function MUST match on both sides or lookups miss. (Known
   imperfection: `normalizeIngredientNameKey` does not strip leading quantities, so "1 tbsp soy
   sauce" and "soy sauce" are distinct keys → near-duplicate tiles. Cosmetic + minor cost only;
   tracked, not blocking — see Follow-ups.)

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

- **`brand-manager` ratification of the Template-A cooked-state change.** The hero cooked-state fix
  (LLM dish description + cooked-state guards, replacing the raw `featuring {ingredients}` clause)
  changed a LOCKED brand artefact (`sloe-image-prompt-template.md` §1). The code shipped first
  (proven via fal) to unblock regeneration; the prompt-doc carries a PENDING-SIGN-OFF banner.
  `brand-manager` to formally ratify and record in `docs/decisions/`. **Linear issue to be opened**
  (Engineering team) — the Linear MCP was not reachable in the implementing session.
- **Ingredient-key quantity pollution.** `normalizeIngredientNameKey` keeps leading quantities, so
  the same ingredient at different amounts gets distinct keys → near-duplicate tiles + minor extra
  fal spend. A stronger canonical key (strip quantity before keying, applied identically at
  write + read) would dedup better. Deferred — needs a deliberate cross-surface change (every
  read site + the migration comment) and does not affect nutrition correctness. Track via Linear.
- **Branded-product tiles occasionally show pseudo-label text.** FLUX can render faint
  packaging-like text on packaged-product ingredients (e.g. protein-supplement tubs) despite the
  never-list, per the prompt-doc §6 caveat. Whole-food tiles are clean. Acceptable for v1; if it
  worsens, move that class to an engine honouring a true `negative_prompt`. Track via Linear.
- **webp transcode.** Generated PNGs are stored as PNG (the model emits png/jpeg, not webp). A
  storage-layer transcode-to-webp is a future optimisation, not a blocker (see `falImageGenerator`
  docblock).

## Related

- Strategy: [`2026-06-03-image-generation-strategy.md`](2026-06-03-image-generation-strategy.md)
- Prompt template (LOCKED): [`../brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md)
- Universal food imagery (marketing/social adoption): [`2026-06-07-universal-food-imagery.md`](2026-06-07-universal-food-imagery.md)
- Superseded hero-fallback auto-gen fragment: [`2026-05-11-hero-fallback-auto-gen.md`](2026-05-11-hero-fallback-auto-gen.md)
