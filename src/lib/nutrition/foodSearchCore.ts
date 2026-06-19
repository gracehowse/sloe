/**
 * 2026-05-15 (ENG-550) — shared food-search core.
 *
 * Both `src/app/components/food-search/FoodSearchPanel.tsx` and
 * `apps/mobile/components/food-search/FoodSearchPanel.tsx` carry parallel
 * implementations of the same lookup logic — relevance scoring, portion
 * resolution, custom-food bridging. The duplication has been a real
 * maintenance tax: when ENG-540 surfaced the `= 1 1 package` cosmetic
 * bug, the fix had to be made in two places. Same for any future
 * ranking / portion change.
 *
 * This module holds the pure, platform-agnostic helpers. Web + mobile
 * panels both import from here. Anything that touches React / Native
 * primitives stays in the panel files.
 *
 * Existing precedent: `portionEqualsLabel` (ENG-540) lives in
 * `src/lib/nutrition/portionEqualsLabel.ts` and is imported by both
 * panels via the same `../../../lib/nutrition/...` path on mobile and
 * `@/lib/nutrition/...` on web. This file follows the same shape.
 */

import { primaryServingToPortionChip, type PrimaryServing } from "./primaryServing";
import {
  type CustomFood,
  type CustomFoodMacrosPer100g,
  customFoodToMacrosPer100g,
  customFoodToPrimaryServing,
} from "./customFoods";

/**
 * A selectable portion in the food-search UI. Identical between web +
 * mobile (and mirrored in `apps/mobile/lib/verifyRecipe.ts` for legacy
 * callers — that file re-exports this canonical type).
 *
 * `servingFraction` is the fraction of `macrosPerServing` represented
 * by ONE unit of this portion. Used when a food's primary serving is
 * a compound count like "8 pieces" — we surface both the original
 * portion (servingFraction = 1) and a derived "1 piece" portion
 * (servingFraction = 1/8). See ENG-537 / ENG-540.
 */
export type FoodPortion = {
  label: string;
  gramWeight: number;
  amount: number;
  servingFraction?: number;
};

/**
 * ENG-745 — the single source of truth for "is this chosen portion a
 * per-serving (no-gram-grounding) portion?". A portion is per-serving
 * when it has no gram weight (`gramWeight === 0`, e.g. a FatSecret
 * "1 large tomato" / "Big Mac" count serving) AND the food carries a
 * per-serving macro payload to use directly. In that case macros are
 * `macrosPerServing × quantity`, never scaled by grams.
 *
 * The preview (`FoodSearchPanel.previewMacros`) and BOTH commit sites
 * (`handleFoodSearchSelect` mobile, `NutritionTracker` web) MUST call
 * this — the 0-kcal bug (ENG-745) was three hand-copied conditions
 * drifting: the preview dropped an obsolete `macrosPer100g === null`
 * clause on 2026-05-14, the two commits didn't, so FatSecret foods with
 * a non-null *zero* per-100g panel fell into the per-100g branch, scaled
 * by `grams = 0`, and persisted 0 kcal while the preview showed the real
 * value. One predicate = the three sites cannot disagree again.
 */
export function isPerServingPortion(args: {
  gramWeight: number;
  hasMacrosPerServing: boolean;
}): boolean {
  return args.hasMacrosPerServing && args.gramWeight === 0;
}

/**
 * Standard unit portions always available in the food-search picker,
 * regardless of the food's API-provided portion set. Provides g/oz/lb
 * conversion + common volumetric units. `gramWeight: 1` for `g` / `ml`
 * means "amount IS grams"; the picker treats those two as the gram
 * basis for scaling.
 */
export const STANDARD_UNITS: FoodPortion[] = [
  { label: "g", gramWeight: 1, amount: 1 },
  { label: "oz", gramWeight: 28.35, amount: 1 },
  { label: "lb", gramWeight: 453.59, amount: 1 },
  { label: "tbsp", gramWeight: 14.79, amount: 1 },
  { label: "tsp", gramWeight: 4.93, amount: 1 },
  { label: "cup", gramWeight: 236.59, amount: 1 },
  { label: "ml", gramWeight: 1, amount: 1 },
];

/**
 * Build the dedup'd portion list shown in the picker for a food.
 *
 * Order:
 *   1. The primary serving chip (if known) — e.g. "1 package", "8 pieces"
 *   2. The standard units (g / oz / lb / tbsp / tsp / cup / ml)
 *   3. Any API-provided portions (FatSecret / USDA / OFF / Edamam) that
 *      aren't already represented, skipping the historical "100 g"
 *      placeholder that USDA emits for per-100g foods.
 *
 * Dedup is case-insensitive on label, with the leading entries
 * winning. The primary serving stays first so the picker defaults to
 * the most "natural" portion (and matches the macros card preview).
 */
export function buildPortions(
  apiPortions: FoodPortion[],
  primary?: PrimaryServingChipInput | null,
): FoodPortion[] {
  const seen = new Set<string>();
  const result: FoodPortion[] = [];
  if (primary) {
    const chip = primaryServingToPortionChip(primary);
    seen.add(chip.label.toLowerCase());
    result.push(chip);
  }
  for (const u of STANDARD_UNITS) {
    const key = u.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(u);
  }
  for (const p of apiPortions) {
    const key = p.label.toLowerCase().trim();
    if (!seen.has(key) && key !== "100 g") {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

/**
 * Thin local alias so `buildPortions` doesn't drag `PrimaryServing` into
 * every test importer's surface. Web + mobile panels already import
 * `PrimaryServing` themselves and pass values here.
 */
type PrimaryServingChipInput = Parameters<typeof primaryServingToPortionChip>[0];

/**
 * Map a free-text unit string to the portion label(s) that should
 * satisfy it. Keep this list aligned with `UNIT_GRAMS` below — if a
 * unit has no portion-label hit, we fall back to converting to grams.
 */
const UNIT_TO_LABEL: Record<string, string[]> = {
  g: ["g"],
  gram: ["g"],
  grams: ["g"],
  oz: ["oz"],
  ounce: ["oz"],
  ounces: ["oz"],
  lb: ["lb"],
  pound: ["lb"],
  pounds: ["lb"],
  cup: ["cup"],
  cups: ["cup"],
  tbsp: ["tbsp"],
  tablespoon: ["tbsp"],
  tablespoons: ["tbsp"],
  tsp: ["tsp"],
  teaspoon: ["tsp"],
  teaspoons: ["tsp"],
  ml: ["ml"],
  "fl oz": ["fl oz"],
  kg: ["g"],
};

/**
 * Gram weights for free-text units. Includes household measures
 * (cup, tbsp, tsp), produce/meat estimates (medium / large / breast /
 * thigh), and common branded units (slice, rasher, clove, can).
 */
const UNIT_GRAMS: Record<string, number> = {
  lb: 453.6,
  pound: 453.6,
  pounds: 453.6,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  kg: 1000,
  cup: 236.59,
  cups: 236.59,
  tbsp: 14.79,
  tablespoon: 14.79,
  tsp: 4.93,
  teaspoon: 4.93,
  ml: 1,
  "fl oz": 29.57,
  breast: 200,
  thigh: 120,
  drumstick: 90,
  wing: 40,
  fillet: 170,
  chop: 150,
  steak: 225,
  leg: 250,
  medium: 110,
  large: 180,
  small: 80,
  slice: 25,
  rasher: 28,
  clove: 4,
  tin: 400,
  can: 400,
};

/**
 * Pick the most appropriate portion + quantity for an incoming
 * (amount, unit) pair. Used when a recipe step says "200 g chicken" or
 * "2 cups rice" — we hand the food's portion list + the parsed
 * (amount, unit) here and get back the best `FoodPortion` + scaled
 * quantity.
 *
 * Resolution order:
 *   1. No unit → grams (or first portion if grams unavailable); default
 *      quantity 100 unless `amount` already looks like grams (>10).
 *   2. Unit maps to a known portion label (via `UNIT_TO_LABEL`) → use
 *      that label. `kg` is the special case where amount * 1000.
 *   3. Unit matches a portion label directly (case-insensitive).
 *   4. Unit has a gram conversion (via `UNIT_GRAMS`) AND the food has
 *      a `g` portion → convert to grams.
 *   5. Fall back to the first portion + raw amount.
 *
 * Accepts `string` for `amount` so web's `parseFloat`-ed inputs work
 * without per-caller coercion. Mobile callers pass plain `number` and
 * the string branch is unused.
 */
export function resolveInitialPortion(
  portions: FoodPortion[],
  amount: number | string | null | undefined,
  unit: string | null | undefined,
): { portion: FoodPortion; quantity: number } {
  const rawAmt = typeof amount === "string" ? parseFloat(amount) : amount;
  const amt = rawAmt != null && rawAmt > 0 ? rawAmt : 1;
  const u = (unit ?? "").trim().toLowerCase();

  if (!u) {
    const gPortion = portions.find((p) => p.label === "g");
    return { portion: gPortion ?? portions[0], quantity: amt > 10 ? amt : 100 };
  }

  const labels = UNIT_TO_LABEL[u];
  if (labels) {
    for (const label of labels) {
      const match = portions.find((p) => p.label.toLowerCase() === label);
      if (match) {
        const qty = u === "kg" ? amt * 1000 : amt;
        return { portion: match, quantity: qty };
      }
    }
  }

  const directMatch = portions.find((p) => p.label.toLowerCase() === u);
  if (directMatch) {
    return { portion: directMatch, quantity: amt };
  }

  const gPerUnit = UNIT_GRAMS[u];
  if (gPerUnit) {
    const gPortion = portions.find((p) => p.label === "g");
    if (gPortion) {
      return { portion: gPortion, quantity: Math.round(amt * gPerUnit) };
    }
  }

  return { portion: portions[0], quantity: amt };
}

/**
 * 2026-05-16 (ENG-550 phase 3) — structural shape for a custom-food
 * row in the food-search list. The `_source: "CUSTOM"` discriminator
 * lets both web's `SearchResult` and mobile's `SearchRow` accept the
 * value structurally — neither needs to know about the other's
 * full union type.
 *
 * Kept intentionally narrow: only the fields `customFoodToHit` actually
 * populates. Both panels happen to declare wider unions; structural
 * subtyping covers the assignment.
 */
export type CustomFoodHit = {
  key: string;
  name: string;
  calsPer100g: number;
  macrosPer100g: CustomFoodMacrosPer100g;
  verified: false;
  primaryServing: PrimaryServing | null;
  _source: "CUSTOM";
  _custom: CustomFood;
};

/**
 * 2026-05-16 (ENG-550 phase 3) — bridge a `CustomFood` (user-submitted
 * food entry) into a search-list row.
 *
 * Both panels previously had this same function (web:
 * `customFoodToSearchResult`, mobile: `customFoodToRow`) with byte-
 * identical bodies — only the return type alias differed. This shared
 * helper returns a structurally-narrow `CustomFoodHit` that fits both
 * surfaces' wider list types via structural subtyping.
 *
 * Why "Custom Brand · Name" display:
 *   - When a user submits a custom food with a brand attribution (e.g.
 *     "Pret · Posh Cheddar"), surfacing the brand on the second line
 *     mirrors FatSecret / Edamam restaurant rows and reduces the
 *     identification load when the user has 10+ custom foods.
 */
export function customFoodToHit(food: CustomFood): CustomFoodHit {
  const macrosPer100g = customFoodToMacrosPer100g(food);
  const displayName = food.brand ? `${food.name} · ${food.brand}` : food.name;
  const primaryServing = customFoodToPrimaryServing(food);
  return {
    key: `custom-${food.id}`,
    name: displayName,
    calsPer100g: macrosPer100g.calories,
    macrosPer100g,
    verified: false,
    primaryServing: primaryServing ?? null,
    _source: "CUSTOM",
    _custom: food,
  };
}

export type UsdaFoodDetailForPreview = {
  macrosPer100g: CustomFoodMacrosPer100g;
  microsPer100g?: Record<string, number>;
  portions?: FoodPortion[];
  primaryPortion?: PrimaryServing | null;
};

export type UsdaSearchHitForPreview = {
  name: string;
  fdcId?: number;
  macrosPer100g?: CustomFoodMacrosPer100g | null;
  microsPer100g?: Record<string, number>;
  primaryServing?: PrimaryServing | null;
};

export type UsdaPreviewFields = {
  name: string;
  source: "USDA";
  macrosPer100g: CustomFoodMacrosPer100g;
  microsPer100g?: Record<string, number>;
  portions: FoodPortion[];
  chosenPortion: FoodPortion;
  quantity: number;
  quantityText: string;
  fdcId?: number;
};

/**
 * Build USDA preview/commit fields from a search hit plus an optional
 * detail fetch. When `/api/usda/food` fails (auth blip, rate limit,
 * offline) but the search row already surfaced structured macros, fall
 * back to the hit so logging never blocks on enrichment.
 */
export function buildUsdaPreviewFields(
  hit: UsdaSearchHitForPreview,
  detail: UsdaFoodDetailForPreview | null | undefined,
  amount: number | string | null | undefined,
  unit: string | null | undefined,
): UsdaPreviewFields | null {
  const macrosPer100g = detail?.macrosPer100g ?? hit.macrosPer100g ?? null;
  if (!macrosPer100g) return null;

  const effectivePrimary = hit.primaryServing ?? detail?.primaryPortion ?? null;
  const portions = buildPortions(detail?.portions ?? [], effectivePrimary);
  const { portion, quantity } = effectivePrimary
    ? { portion: portions[0], quantity: 1 }
    : resolveInitialPortion(portions, amount, unit);

  const microsPer100g = detail?.microsPer100g ?? hit.microsPer100g;

  return {
    name: hit.name,
    source: "USDA",
    macrosPer100g,
    ...(microsPer100g ? { microsPer100g } : {}),
    portions,
    chosenPortion: portion,
    quantity,
    quantityText: String(quantity),
    ...(hit.fdcId != null ? { fdcId: hit.fdcId } : {}),
  };
}
