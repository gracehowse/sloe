# Julienne's nutrition estimation — reverse-engineered (verified) — 2026-06-08

**Status:** Confirmed first-hand. Source = Julienne's public shipped web bundle `https://withjulienne.com/assets/index-f24fde0f.js` (3.58 MB, the JavaScript every browser downloads). Fetched + grepped directly on 2026-06-08 (not second-hand). Companion to `docs/research/2026-06-07-julienne-image-system.md`.

## TL;DR
Julienne **re-computes** recipe nutrition from parsed ingredients (it does NOT copy the creator's caption). But the macro engine is **a tiny hardcoded in-app lookup table + naive substring matching + fixed piece-weights, with no external food database, no API, and no plausibility check.** It is confident-looking (shows %DV) but easily ~2× wrong on common foods — and its own macros don't even reconcile with the calorie number it shows. This is a direct, demonstrable accuracy moat for Suppr.

## How macros are computed (CONFIRMED from bundle)
- Recipe detail calls `MacroCalculationService.calculateMacros()` → per ingredient `getIngredientMacros()` → looks up a hardcoded per-100g object `INGREDIENT_MACROS`, converts quantity to grams, sums, `/servings`. **No nutrition API, no LLM in this path** (the LLM only does upstream extraction of `{ingredients, steps, servings}`).
- **The table (verbatim, excerpt):**
  ```js
  INGREDIENT_MACROS = {
    chicken:{carbs:0,protein:23,fats:3.6}, "chicken breast":{carbs:0,protein:31,fats:3.6},
    beef:{carbs:0,protein:26,fats:15}, salmon:{carbs:0,protein:25,fats:14},
    eggs:{carbs:1.1,protein:13,fats:11}, milk:{carbs:4.8,protein:3.4,fats:3.25},
    cheese:{carbs:1,protein:25,fats:33}, "cheddar cheese":{carbs:1,protein:25,fats:33},
    mozzarella:{...}, parmesan:{...}, butter:{...}, rice:{carbs:78,...}, pasta:{...}, bread:{...}, …
  }
  ```
  ~a few dozen distinct foods (many keys are just plurals/variants). No `cottage cheese`, no thousands of branded items.
- **The matcher (verbatim — the substring fallback):**
  ```js
  for (… of Object.keys(this.INGREDIENT_MACROS))
      if (e.includes(i) || i.includes(e)) return o;   // matches if EITHER string contains the other
  return null
  ```
- **Fixed piece-weights (verbatim):** `estimateWeightForPieces = { bread:30, cheese:20, cheddar:20, brie:25, mozzarella:20, prosciutto:15, ham:20, tomato:25, onion:15, … }` grams per "piece"/"slice".
- **No external nutrition DB/API:** grep for `usda|fdc|edamam|nutritionix|spoonacular|openfoodfacts|fatsecret` → **zero hits** in the consumer bundle.

## The 33g-vs-17g protein bug (CONFIRMED mechanism)
Importing a toastie whose creator said *"Approx. 480 kcal & 17g protein"*, Julienne showed **33g protein** (+ 140g carbs, 18g fat).
- `"cottage cheese"` is **not a key** in `INGREDIENT_MACROS` (verified: lookup returns blank; its 6 bundle occurrences are all in dairy *category* lists, never the macro table).
- So the matcher's substring fallback runs `"cottage cheese".includes("cheese") → true` → returns **`cheese:{protein:25,fats:33}`** per 100g. Cottage cheese is really ~11g protein / ~4g fat. → ~2.3× protein, ~8× fat over-count from one bad substring hit.
- Fixed piece-weights compound it ("2 tbsp cottage cheese" mis-weighed as a 20g "piece" of *hard* cheese).
- **Internal contradiction:** Julienne's own 33P + 140C + 18F ≈ **854 kcal** by Atwater, yet it displays **480 kcal** — because calories come from a *separate* server function (`calculateRecipeCalories`, opaque) decoupled from the client macro engine. The two never cross-check.
- **The creator's ~17g is the more plausible number.** Julienne is wrong.

## Other fields
- **Est. Cost:** server fn `calculateRecipeCost` (US pricing estimate). **Skill Level:** `recipe.difficulty`, defaults to `"easy"`, user-editable. **Cook Time:** extracted from source. **%DV:** computed vs the user's personalised TDEE targets → inherits both the macro error AND the target-model assumptions.

## Sentiment
Zero App Store / ProductHunt reviews mention nutrition accuracy. The loud complaints are data-loss + crash-on-import. Interpretation: the macro panel is treated as **decorative garnish nobody verifies** — a 2× error goes unreported. A vulnerability disguised as silence.

## Suppr's differentiation (the moat)
Suppr's engine (`src/lib/nutrition/verifyIngredients.ts`):
| | Julienne | Suppr |
|---|---|---|
| Source | one tiny hardcoded table + substring match | multi-source cascade: Suppr customs → USDA → OFF → Edamam → FatSecret → local |
| Matching | `name.includes(key)` first-hit-wins | scored `confidenceForMatch` (penalises irrelevant words); UK/AU synonym map; raw-vs-cooked mismatch detection |
| Confidence gate | none — every match shown as fact | `MIN_ACCEPT_CONFIDENCE = 0.55`; sub-threshold lines **excluded from headline totals** + "ask to verify" |
| Count→weight | fixed piece-weights | edible-weight normalisation (CLAUDE.md) |
| Plausibility | none (kcal & macros contradict) | **Atwater ratio guard** (kcal ≈ 4P+4C+9F) rejects impossible rows |
| Honesty | precise grams + %DV, no provenance | per-line source + confidence; recipe-level min+mean; "don't guess" is a hard rule |

The exact cottage-cheese→cheese bug is **structurally impossible** in Suppr (scored match demotes the weak overlap; confidence gate won't fold a guess into the total; Atwater guard catches the kcal/macro contradiction).

## Positioning / marketing angle
For the "love food AND have goals" user who actually reads the protein number:
> *"Other recipe apps call cottage cheese 'cheese' and double your protein. Suppr matches it right — and tells you how confident it is."*
A side-by-side import of a common food (cottage cheese, a "slice" of bread, Greek yogurt) is a concrete, screenshot-able trust story for the viral import before/after — and it's the part of the wedge competitors can't shortcut. → route to `brand-manager` / content calendar.

## Caveat
The **macros** above are 100% client-side and fully verified from source. The **calorie** number comes from a server function whose body isn't in the client bundle — kcal *could* be smarter server-side; but the macros (the contradicting numbers) are provably this crude path.
