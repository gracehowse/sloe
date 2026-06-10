# Universal food imagery for Today's Meals rows

> **Date:** 2026-06-07 · **Area:** Today tab / Imagery · **Status:** Proposed (tentative — awaiting Grace's A/B/C pick)
> **Owner:** brand-manager (imagery) + Today-tab eng
> **Depends on:** the locked prompt template [`docs/brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md)
> and the engine decision [`docs/decisions/2026-06-03-image-generation-strategy.md`](2026-06-03-image-generation-strategy.md).

## The problem this resolves

`TodayMealsFigmaLayout.tsx` renders each meal-slot row with a 64px leading tile. Today the tile is
**photo-when-recipe**: a library recipe shows its hero photo (`mealRowImageUrl(primary)`), but a single
logged food — coffee, an apple, three eggs — has no photo, so it falls back to a flat `Utensils` icon
tile. A real day mixes both, so the list reads as **half-finished**: rich on recipe rows, bare on the
foods people log most. That A/B inconsistency is the entire motivation here.

Three options were prototyped side-by-side with **real FLUX 2 Pro imagery** (not mocks) in
[`docs/prototypes/meal-row-imagery-compare.html`](../prototypes/meal-row-imagery-compare.html),
captured at `screenshots/imagery-proto/meal-row-compare.png`:

| Option | Treatment | Verdict |
|---|---|---|
| **A — consistent icon** | every row is the same calm utensils tile | Calmest + zero photo dependency, but a column of identical glyphs is flat — nothing pulls the eye to what you ate. |
| **B — photo-when-recipe (current)** | recipe rows get the dish photo; single foods get the icon | The shipped behaviour. The mixed rhythm is the bug — the list looks unfinished. |
| **C — universal imagery (proposed)** | **every row gets a real image**; recipes use the Template-A dish photo, single foods use a Template-B ingredient photo; rare misses get one clean fallback tile | Consistent rhythm, appetising, the food does the work. Recommended. |

**Recommendation: Option C.** It removes the inconsistency by *raising* every row to imagery rather than
*lowering* every row to an icon (Option A), and it leans into the Sloe "love food + have goals"
positioning — the meal list should look like food, not a spreadsheet.

## The proposal (Option C)

1. **Pre-generate a Template-B image for the top-N canonical logged foods.** These are not user recipes —
   they're the universal vocabulary of single foods (egg, banana, apple, coffee, milk, chicken breast,
   oats, rice, …). Generate once, ship as static brand assets (Supabase Storage / app bundle), reuse
   across all users forever. No per-user generation, no runtime cost for this set.
2. **Cache by normalised food key.** Reuse the strategy doc's cache model: the lookup key is a
   **normalised hash of the canonical food name** (lower-cased, singularised, brand/qualifier-stripped),
   so "an apple", "Apple", "1 apple", "red apple" all resolve to the same `apple` asset. This is the
   single-ingredient analogue of the strategy doc's "cache key = normalised(ingredient list + dish name)".
3. **Recipe rows keep using their own hero** (`mealRowImageUrl`) — Template-A, already wired. No change.
4. **Clean fallback for the long tail.** A food with no canonical asset and no recipe hero renders one
   warm Sloe fallback tile (the existing monogram/utensils slab, §11.4 of the design system) — never a
   broken image, never a second-rate generation. *A weak placeholder beats an off-brand one.* The
   prototype's milk row demonstrates this fallback state.

### Coverage strategy — which foods first

Tiered, frequency-led, so spend tracks impact:

- **Tier 1 — the ~50 foods that dominate logging.** Pull the top foods from `food_history` / quick-log
  frequency (egg, banana, apple, coffee, milk, chicken breast, rice, oats, Greek yoghurt, avocado,
  bread, peanut butter, salmon, broccoli, almonds, …). These cover the overwhelming majority of
  single-food rows. Generate, eyeball against the §8 checklist, ship.
- **Tier 2 — next ~150 by frequency.** Diminishing returns; batch as time allows.
- **Long tail — everything else.** Falls back to the clean tile (step 4). No attempt to cover exhaustively.

Because logging frequency is heavily power-law, **~50 assets likely cover the large majority of
single-food rows** — Tier 1 alone makes the list feel universally imaged in practice.

## Cost estimate

- **One-off, design-time, trivial.** FLUX 2 Pro is **~$0.01–0.04/image** (per the strategy doc).
  Tier 1 (50) ≈ **$0.50–$2.00**. Tier 1+2 (200) ≈ **$2–$8**. Total. Forever. Reused across every user.
- **Zero marginal runtime cost** for the canonical set — these are static assets, not per-user
  generations, so they sit entirely outside the runtime free-cap / Pro-gate economics that govern the
  recipe "Generate an image" feature.
- This validation batch (8 images for the prototype) cost well under **$1**.

## Validation done this session

Per *SEE-don't-orchestrate* and the strategy doc's "render-validation pending" gate (line 79), the brand
sign-off required ~10 real FLUX 2 Pro outputs eyeballed against the §8 reviewer checklist. Done:
**8 images generated and reviewed**, all passing — Template B (eggs, black coffee, apple, banana, milk,
grilled chicken breast) on clean white with soft shadow, and Template A (Chicken Frittata, Tahini Grain
Bowl, Chicken & Avocado Salad) as moody editorial dishes. No on-image text, people, or hands; warm muted
palette; appetising and ingredient-faithful. Assets in `screenshots/imagery-proto/`.

One engine note: `fal-ai/flux-2-pro` on fal **does not expose a separate `negative_prompt` field** (only
`prompt`, `image_size`, `seed`, `output_format`, `safety_tolerance`). The template's §5 never-list was
therefore appended to the positive prompt as a trailing `Avoid: …` clause. Results were on-brand, but if
a future batch shows the negative leaking (FLUX can occasionally summon negated nouns from a positive
"avoid"), switch to an engine that honours a true negative prompt, or move the never-list into the budget
fallback model. Worth recording in the template's change log if it recurs.

## Open questions

- **Approval to proceed with Option C** and to fund the Tier-1 batch (Grace's pick of A/B/C).
- **Asset hosting:** bundle the ~50 Tier-1 PNGs in the app vs serve from Supabase Storage (lean Storage
  for cache-key parity with the runtime recipe feature; revisit if bundle size matters).
- **Normalisation source:** reuse the existing food-key normaliser if one exists, else a small shared
  util — must be identical web + mobile so the same key resolves to the same asset on both platforms.

## Links

- Prompt template (locked): [`docs/brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md)
- Engine / cost strategy: [`docs/decisions/2026-06-03-image-generation-strategy.md`](2026-06-03-image-generation-strategy.md)
- Side-by-side prototype: [`docs/prototypes/meal-row-imagery-compare.html`](../prototypes/meal-row-imagery-compare.html)
- Comparison screenshot: `screenshots/imagery-proto/meal-row-compare.png`
- Generated assets: `screenshots/imagery-proto/*.png`
- Live layout this changes: `apps/mobile/components/today/TodayMealsFigmaLayout.tsx`
