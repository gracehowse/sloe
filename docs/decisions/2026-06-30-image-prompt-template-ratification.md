# Image-prompt template — `brand-manager` ratification (ENG-987)

- **Date:** 2026-06-30
- **Area:** Brand — generated imagery (the LOCKED Sloe image prompt template); recipe heroes + ingredient tiles (web + mobile)
- **Status:** Ratified (Grace approved "Ratify", 2026-06-30). Doc-only — the prompt engine
  already shipped 2026-06-08 and is test-pinned; this decision changes **zero** code.
- **Linear:** ENG-987 (the three LOCKED-artefact changes shipped code-first 2026-06-08, ratification
  pending). Unbuilt fast-follow split out to ENG-1276 (see below).

## What is being ratified

The three LOCKED-artefact changes to
[`docs/brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md) that shipped
code-first on 2026-06-08 (proven via fal before the code landed) are now **ratified** as the imagery
direction of record. This satisfies the prompt-template doc's change-control clause (§9: "Record material
changes in `docs/decisions/`"). The three PENDING-`brand-manager`-sign-off banners on the template are
struck in the same change; the §6 Model row + the §1/§2 engine notes are corrected to reflect the
**tiered** model posture (ENG-999), not the interim "unified on Nano for all classes" wording.

### 1. Hero cooked-state fix — RATIFIED

The Template-A per-dish prompt no longer lists the recipe's raw ingredients verbatim (the old
`…featuring {KEY_INGREDIENTS}…` clause, which made the model render whole raw eggs on a frittata and loose
protein powder heaped on porridge — the model followed the positive prompt *literally*). The cure has two
parts, both KEPT in the shipped code:

1. **LLM dish-appearance step** (`describeDishAppearance`, `src/lib/server/llmDishAppearance.ts`) — a cheap
   low-temp call returns one-to-two sentences describing the FINISHED, cooked, plated dish, naming only
   ingredients visible when served, never implying raw ingredients sit on top. Fail-safe: any LLM failure
   falls back to a generic cooked clause; generation is never blocked.
2. **Cooked-state guards** in the fixed `DISH_SYSTEM_PROMPT` (`src/lib/server/falImageGenerator.ts`):
   "The dish is fully cooked and integrated, served exactly as it would be eaten — no raw or uncooked
   ingredients, no whole raw eggs, no loose powder, nothing raw piled on top."

Forensic per-image validation: recorded in the 2026-06-08 decision doc
([`2026-06-08-recipe-ingredient-image-system.md`](2026-06-08-recipe-ingredient-image-system.md),
"Hero cooked-state fix + regeneration" + "Re-verification (forensic, per-image — not a thumbnail glance)"):
all 6 regenerated heroes Read against 5 checks (raw-on-top, raw eggs, loose powder, hands/people,
on-brand) — **all 6 PASS**, including the Chicken Frittata and Protein Overnight Oats that previously
failed. That table is the evidence for this ratification.

### 2. Hero engine — Nano Banana Pro — RATIFIED

Dish heroes (Template A) run on **Nano Banana Pro** (`fal-ai/nano-banana-pro`, Google Gemini 3 Pro Image),
migrated FLUX 2 Pro → Nano on 2026-06-08 for hyper-realism (verified markedly more photoreal than FLUX on
the meatballs A/B — a real cookbook-grade photograph vs FLUX's flatter render). The editorial house style
+ cooked-state guards ride on the fixed `DISH_SYSTEM_PROMPT` (a true Gemini-3 system instruction, stronger
than a positive avoid-clause); params `aspect_ratio: "4:3"`, `resolution: "2K"`, `output_format: "jpeg"`,
**NO fixed seed** (each dish is unique — variety is fine); the per-recipe cache (keyed by `recipe_id`) is
unchanged.

### 3. Ingredient tiles — FLUX tier (per ENG-999) — RATIFIED, with the tiering correction

**Ingredient tiles (Template B) run on the cheaper FLUX tier, NOT Nano.** This is the correction the
interim doc wording missed: the 2026-06-08 banners and the §6 Model row described the app as "unified on
Nano for all classes," but ENG-999 (2026-06-19 cost guardrail + model tiering) moved ingredient generation
to the cheaper FLUX path. Ingredient tiles are high-volume, simple, single-subject white-background images
that are cached globally and cheap to re-shoot, so they do not warrant 2K Nano economics; heroes are
high-visibility and shared, so they stay on Nano. The Template-B **prompt contract is unchanged** (the
fixed `INGREDIENT_SYSTEM_PROMPT` + fixed seed + the single-representative-subject per-image line) — only
the engine tier changed. **Template-B fixed seed 424242** is ratified (`INGREDIENT_SEED = 424242` in
`falImageGenerator.ts`), so the whole ingredient set is reproducibly coherent.

## Cited live code (verified by reading `src/lib/server/falImageGenerator.ts`)

- **Hero default = Nano Banana Pro.** `HERO_FAL_MODEL = process.env.FAL_HERO_IMAGE_MODEL?.trim() ||
  "fal-ai/nano-banana-pro"`. `generateDishImage` (the Template-A entry point) calls `runNano` with
  `{ systemPrompt: DISH_SYSTEM_PROMPT, aspectRatio: "4:3" }` and NO seed, `modelId: HERO_FAL_MODEL`.
- **Ingredient default = FLUX tier (ENG-999).** `FALLBACK_FAL_MODEL = process.env.FAL_IMAGE_MODEL?.trim()
  || "fal-ai/flux/dev"`; `INGREDIENT_FAL_MODEL = process.env.FAL_INGREDIENT_IMAGE_MODEL?.trim() ||
  FALLBACK_FAL_MODEL`. `generateIngredientImage` (the Template-B entry point) calls `runNano` with
  `{ systemPrompt: INGREDIENT_SYSTEM_PROMPT, aspectRatio: "1:1", seed: INGREDIENT_SEED }`,
  `modelId: INGREDIENT_FAL_MODEL`. (The shared `runNano` runner branches on `isFluxModel(modelId)`: for a
  FLUX model it folds the system prompt into the positive prompt and maps the aspect ratio to a named
  `image_size`; for Nano it passes `system_prompt` + `aspect_ratio` through directly — Nano has no
  `negative_prompt` field.)
- **`DISH_SYSTEM_PROMPT`** is exported and pinned by the guard test (`tests/unit/falImageGenerator.test.ts`)
  so the cooked-state guards + editorial register + no-people/no-text guards break the test if removed —
  they are the load-bearing raw-eggs protection now they live in the system prompt.
- **Template-B fixed seed:** `const INGREDIENT_SEED = 424242;`.

## Unbuilt fast-follow — tracked, not pending here (ENG-1276)

The two unbuilt items the 2026-06-08 decision doc parked under ENG-987's fast-follow are **post-launch**
and tracked under **ENG-1276** — they are NOT pending as part of this ratification:

- **Matched-food-name persistence.** The tile label should prefer the matched food name (e.g. the
  FatSecret match's name), but `recipe_ingredients` has no `matched_food_name` column; v1 uses
  `cleanIngredientDisplayName(name)` (the spec's documented fallback). Needs a schema + persistence change.
- **Ingredient-image alias storage.** `canonicalImageKey` computes a high-confidence
  `matchedAliasKey(source, food_id)` but there is no alias storage — so a differently-spelled future
  ingredient that matched the SAME food doesn't yet share a tile via the alias path (it still shares via
  the text key when those converge). The matched id is null across the whole seed corpus today, so neither
  fires yet.

## Why ratify rather than re-open

The changes have shipped, are test-pinned (the `DISH_SYSTEM_PROMPT` guard test breaks if the cooked-state
protection is removed), and were forensically validated per-image at ship time. The only doc-level debt was
(a) three stale PENDING banners implying the direction was still unapproved, and (b) the interim
"unified on Nano for all classes" wording that ENG-999 superseded. Ratifying clears both without touching
code. Confidence: 9/10 — the engine + seed + system prompts are verified against the live code; the only
residual is the usual fal model/price drift, already guarded by `falBudget.ts` over-counting unknown models.

## Related

- LOCKED prompt template: [`../brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md)
- Implementation + forensic validation: [`2026-06-08-recipe-ingredient-image-system.md`](2026-06-08-recipe-ingredient-image-system.md)
- Image-generation strategy: [`2026-06-03-image-generation-strategy.md`](2026-06-03-image-generation-strategy.md)
- Universal food imagery (marketing/social Nano adoption): [`2026-06-07-universal-food-imagery.md`](2026-06-07-universal-food-imagery.md)
- ENG-999 cost guardrail + model tiering: recorded in
  [`2026-06-08-recipe-ingredient-image-system.md`](2026-06-08-recipe-ingredient-image-system.md)
  ("ENG-999 cost guardrail + model tiering")
- Live code: `src/lib/server/falImageGenerator.ts`, `src/lib/server/llmDishAppearance.ts`,
  `src/lib/server/falBudget.ts`
