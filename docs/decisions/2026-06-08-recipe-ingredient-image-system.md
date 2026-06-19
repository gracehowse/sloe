# Recipe + ingredient image system (Sloe imagery, runtime + backfill)

- **Date:** 2026-06-08
- **Area:** Recipes — imagery (web + mobile); nutrition pipeline (display only)
- **Status:** Resolved — implemented + backfilled (fal.ai funded 2026-06-08); hero cooked-state fix
  applied + heroes regenerated 2026-06-08; **canonical-key re-key + Nano Banana Pro ingredient re-shoot
  + lazy generate-on-miss shipped 2026-06-08** (see "Canonical key + Nano + lazy generation (2026-06-08)"
  below — the Template-B engine change awaits `brand-manager` ratification, tracked ENG-987). **Dish heroes
  (Template A) migrated FLUX 2 Pro → Nano Banana Pro 2026-06-08 (code + tests + docs done; the 6-hero
  regeneration is BLOCKED on fal balance — exhausted mid-session — see "Dish heroes (Template A) → Nano
  Banana Pro" below; LOCKED-artefact change also awaits `brand-manager` ratification, ENG-987).** Builds on
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
  fast-follow ENG-987.

### 2. Ingredient engine → Nano Banana Pro (Template B)

`generateIngredientImage` switched FLUX 2 Pro → `fal-ai/nano-banana-pro` (Google Gemini 3 Pro Image) with
a FIXED `system_prompt` (the consistency lever — identical lighting/scale/shadow on every call) + a FIXED
`seed: 424242`, `aspect_ratio: "1:1"`, `resolution: "2K"`, `output_format: "jpeg"`. The per-image prompt
is reduced to the ONE representative subject (`A single {x}.`; loose foods → `A small neat mound of {x}.`;
liquids → `A small unlabelled portion of {x} …`) — **never the literal recipe quantity**. This fixes the
FLUX ingredient drift (pile-vs-bowl, "4 eggs" for one ingredient, egg-white-rendered-as-a-milk-bottle).
**Template A (dish heroes) is UNCHANGED — still FLUX 2 Pro.** The LOCKED template (§2) is updated with a
PENDING-`brand-manager`-sign-off banner (ENG-987).

### 3. Lazy generate-on-miss + cache (the library grows itself)

`fetchIngredientImages` now returns `{ map, missingKeys }`; the display layer (web `RecipeDetail.tsx` +
mobile `recipe/[id].tsx`, via the shared `enqueueIngredientImages` helper) fires
`POST /api/ingredient-image` for any canonical key with no `ready` image. The endpoint idempotently claims
each key `pending` via an atomic `insert … on conflict do nothing` (so two devices / two rows for the same
ingredient never double-spend fal), generates with Nano, and caches `ready`. **Never blocks render**
(fire-and-forget; the screen re-hydrates on its next load), **never regenerates an existing key**, and
degrades to the calm placeholder on any fal/DB error. Per-user rate-limited; capped at 6 keys/request. ENG-999 also makes ingredient generation default to the cheaper FLUX tier (`FAL_INGREDIENT_IMAGE_MODEL`, falling back through `FAL_IMAGE_MODEL` to `fal-ai/flux/dev`) while keeping the same Template-B prompt contract; cached rows mean any ingredient is still generated once.
The candidate-selection logic is extracted to a pure, unit-tested helper
(`src/lib/recipe/ingredientImageQueue.ts`).

### Re-key + regeneration run (2026-06-08)

Ran `backfill-images.ts --apply --ingredients-only --regenerate-ingredients` (new force flag) to re-key +
re-shoot the WHOLE ingredient library on Nano: **43/43 canonical keys regenerated** (overwriting the old
inconsistent FLUX tiles). Old-key orphan rows (the 51 − matched pre-existing keys) deleted post-run.
Forensic per-image verification of a ~15-image sample (incl. egg, egg white, oat/almond, chicken cuts,
cherry tomato, salt, a leafy green, a branded sauce) + a stitched set-consistency strip: see the
implementing session report.

## Dish heroes (Template A) → Nano Banana Pro (2026-06-08, later same day)

The last imagery class still on FLUX 2 Pro — the recipe dish heroes (Template A) — **migrated to Nano
Banana Pro** (`fal-ai/nano-banana-pro`, Google Gemini 3 Pro Image), unifying the WHOLE app on one model
(ingredients moved earlier this day; marketing/social already on Nano per
[`2026-06-07-universal-food-imagery.md`](2026-06-07-universal-food-imagery.md)).

**Why.** Nano is markedly more photoreal than FLUX for dish heroes — verified on the meatballs A/B (a real
cookbook-grade photograph vs FLUX's flatter render). One engine also simplifies cost, ops, and the prompt
templates.

**What changed in code** (`src/lib/server/falImageGenerator.ts` `generateDishImage`):
- Model `fal-ai/flux-2-pro` → `fal-ai/nano-banana-pro`; params `aspect_ratio: "4:3"` (landscape hero),
  `resolution: "2K"`, `output_format: "jpeg"`. **NO fixed seed** (each dish is unique — variety is fine,
  unlike the ingredient set which pins seed 424242). The per-recipe cache (keyed by `recipe_id`) is
  unchanged.
- The editorial house style + cooked-state guards moved from a FLUX positive-prompt fold-in into a FIXED
  `DISH_SYSTEM_PROMPT` (the consistency lever, mirroring the ingredient path — a true Gemini-3 system
  instruction, which Nano honours and which is stronger than a positive avoid-clause). The per-dish
  `prompt` is now just `Hyperreal editorial food photography of {TITLE}. {LLM_DESCRIPTION}`.
- **KEPT:** the `describeDishAppearance` LLM step (the raw-eggs fix — it writes a cooked-dish description,
  never a raw ingredient list) and the cooked-state guards (now inside `DISH_SYSTEM_PROMPT`). The
  `runFlux` runner + the FLUX-only `STYLE_ANCHOR`/`AVOID_CLAUSE`/`COOKED_STATE_GUARDS`/`inferPlatingNoun`
  constants were deleted (dead after the migration); `runNano` is now ONE runner for both classes (dish =
  4:3/no-seed/dish-system-prompt; ingredient = 1:1/seed/ingredient-system-prompt).
- **Reliability + never-hang (added this session):** `runNano` now uses active polling
  (`mode: "polling"`, `pollInterval: 1000`, `logs: true`, `onQueueUpdate`) — without an active
  queue-update subscription the 2K Nano `subscribe` polls very slowly and can appear to hang. It is also
  wrapped in a function-level `withTimeout` (`NANO_TIMEOUT_MS = 180s`, fal's own client `timeout` is
  documented as not enforced), so a stuck call returns a typed `fal_network_error` and the caller falls
  back to the placeholder rather than blocking a backfill / server request forever.

**Tests:** `tests/unit/falImageGenerator.test.ts` updated — `buildDishPrompt` now asserts the short
title + description shape and that the house style is NOT in the per-dish line; a new block pins
`DISH_SYSTEM_PROMPT` (exported) so the cooked-state guards + editorial register + no-people/no-text guards
break the test if removed (they are the load-bearing raw-eggs protection now). Graceful-degradation tests
unchanged (still pass). 18/18 green.

**Docs:** `docs/brand/sloe-image-prompt-template.md` §1 (Template A) + §6 (Model row) + top banner updated
to the Nano + FIXED-`system_prompt` recipe, with the PENDING-`brand-manager` banner kept. The
LOCKED-artefact Template-A model change is ratification-pending alongside the cooked-state + Template-B
changes (ENG-987).

### ⚠️ Regeneration BLOCKED — fal balance exhausted mid-session (2026-06-08)

The 6-hero regeneration (`backfill-images.ts --apply --heroes-only --regenerate-heroes`) is **staged but
not yet run to completion**: the funded fal balance was **exhausted during this session** (the validation
probes + retried generations drained it). Every Nano call now 403s with
`"User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."`

- **Code path is PROVEN.** Before the balance ran out, a single end-to-end Nano dish generation produced a
  correct hyper-realistic 4:3/2K hero (Chicken Meatballs with Orzo — read forensically: photoreal, cooked,
  no raw ingredients, no hands, on-brand editorial). The new params + `system_prompt` passthrough are
  validated against the live endpoint.
- **No data was harmed.** `generateDishImage` only generates + uploads to Storage; the **DB write happens
  only on a successful backfill**, and every backfill Nano call 403'd, so `recipes.image_url` is
  **unchanged** — all 6 heroes still point at the original FLUX `.png` files and the 2 imported Instagram
  covers are untouched. This is the graceful-degradation contract working as designed.
- **To finish:** top up fal at fal.ai/dashboard/billing, then run
  `node --env-file=.env.local --import tsx scripts/backfill-images.ts --apply --heroes-only --regenerate-heroes`.
  It overwrites the 6 FLUX `.png` heroes with new Nano `.jpg` heroes and leaves the 2 imported covers
  alone. Then forensically Read each of the 6 regenerated heroes (the per-hero check: hyper-real, no
  raw/uncooked, no raw eggs, no hands, on-brand) before trusting the display.

## ENG-999 cost guardrail + model tiering (2026-06-19)

Founder concern: the 2026-06-08 imagery session burned roughly $30/day while regenerating the
ingredient library, running Nano-vs-FLUX probes, and retrying against an exhausted balance. That
was mostly one-time setup work, but at viral volume a runaway lazy-generation loop or per-recipe
hero spike must not silently spend against fal.

**Decision shipped:**

- **Hard fal budget guardrail.** `src/lib/server/falBudget.ts` reserves fixed per-image spend before
  any fal request, tracks both UTC-day and UTC-month counters in Upstash (with the same in-memory
  local/test fallback pattern as the token AI budget), emits a one-per-period 70% warning, and hard
  denies generation once the cap is exceeded. Defaults: `FAL_BUDGET_DAILY_GBP=10`,
  `FAL_BUDGET_MONTHLY_GBP=150`; enforcement is on unless `FAL_BUDGET_ENFORCEMENT_ENABLED=false`.
  Failed vendor/download/upload paths refund the reservation; successful storage writes commit it.
- **Model tiering.** Heroes default to Nano Banana Pro via `FAL_HERO_IMAGE_MODEL` (fallback
  `fal-ai/nano-banana-pro`) because they are high-visibility and cached per recipe. Ingredient tiles
  default to the cheaper FLUX path via `FAL_INGREDIENT_IMAGE_MODEL` (fallback to `FAL_IMAGE_MODEL`,
  then `fal-ai/flux/dev`) because they are high-volume, simple, single-subject white-background
  images. The old `FAL_IMAGE_MODEL` remains a global/bulk override for backwards compatibility.
- **Cost model.** Guardrail accounting prices Nano at 11p/image (~$0.13 at £0.85/$), FLUX 2 Pro at
  3p/image (~$0.025 rounded up), and FLUX dev at 2p/image. Unknown fal models deliberately fall
  back to the Nano price so spend is over-counted rather than under-counted until the table is
  updated.
- **Dev/test discipline.** A/B probes or speculative regenerations now have to pass the same daily +
  monthly budget reservation as production calls. Backfills remain dry-run by default and should be
  scoped with `--heroes-only` / `--ingredients-only` / `--limit` when validating prompt changes.

**Why this loses less than the alternatives.** Keeping Nano everywhere is visually safest but makes
viral ingredient lazy-generation ~5× more expensive than necessary; moving everything to FLUX saves
money but weakens the recipe hero surface that users actually share and judge. The tiered default
keeps Nano where quality matters most and uses FLUX where the image is simple, cached, decorative,
and cheap to re-shoot later if the ingredient set needs a premium pass. Confidence: 8/10 — actual fal
pricing should still be re-checked when models/prices change, but the guardrail intentionally
over-counts unknown models.

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

- **🔴 Run the 6-hero regeneration once fal balance is topped up** (BLOCKED 2026-06-08 — fal exhausted
  mid-session, every call 403s `"User is locked. Reason: Exhausted balance"`). Code/tests/docs for the
  Template-A → Nano migration are DONE and the path is proven (one end-to-end hero generated correctly
  before the balance ran out). To finish: top up at fal.ai/dashboard/billing, then
  `node --env-file=.env.local --import tsx scripts/backfill-images.ts --apply --heroes-only --regenerate-heroes`,
  and forensically Read each of the 6 regenerated heroes before trusting the display. The DB is currently
  untouched (all 6 heroes still the original FLUX `.png`; 2 imported covers intact). See "Dish heroes
  (Template A) → Nano Banana Pro" above.
- **`brand-manager` ratification of the Template-A cooked-state change, the Template-A ENGINE migration
  (FLUX → Nano), AND the Template-B Nano switch** (ENG-987). Three LOCKED-artefact changes shipped
  code-first (proven via fal): (a) the §1 hero cooked-state fix (LLM dish description + cooked-state guards,
  replacing the raw `featuring {ingredients}` clause); (b) the §1 dish-hero ENGINE move FLUX → Nano Banana
  Pro (4:3/2K/jpeg, no seed, house style + guards on the FIXED `DISH_SYSTEM_PROMPT`); and (c) the §2
  ingredient ENGINE move FLUX → Nano + the FIXED `system_prompt`/seed. All affected prompt-doc sections
  carry a PENDING-SIGN-OFF banner. `brand-manager` to formally ratify and record in `docs/decisions/`.
- **Matched-food-name persistence + alias storage** (ENG-987, fast-follow). Two related gaps: (1) the
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
- **fal price table re-verification.** Re-check `src/lib/server/falBudget.ts` prices when fal updates model pricing; unknown models currently over-count at Nano pricing so caps stay conservative.
- **webp transcode.** Generated images are stored as JPEG (Nano emits jpeg/png, not webp). A storage-layer
  transcode-to-webp is a future optimisation, not a blocker (see `falImageGenerator` docblock).

## Related

- Strategy: [`2026-06-03-image-generation-strategy.md`](2026-06-03-image-generation-strategy.md)
- Prompt template (LOCKED): [`../brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md)
- Universal food imagery (marketing/social adoption): [`2026-06-07-universal-food-imagery.md`](2026-06-07-universal-food-imagery.md)
- Superseded hero-fallback auto-gen fragment: [`2026-05-11-hero-fallback-auto-gen.md`](2026-05-11-hero-fallback-auto-gen.md)
