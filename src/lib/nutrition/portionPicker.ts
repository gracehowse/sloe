/**
 * Portion picker — shared state model for the barcode + custom-food
 * portion-selection UI on web + mobile.
 *
 * Replaces the legacy `logBasis: "per100g" | "perServing"` toggle that
 * forced the user to pick a *mode* before saying how much they wanted.
 * The new model is a single `{ amount, unit }` pair. The unit IS the
 * mental model the user is in (meatball / serving / gram / ounce) and
 * the amount is just a number that scales by it.
 *
 * See `docs/decisions/2026-05-13-portion-picker-and-macro-display.md`
 * for rationale.
 */

import { scaleFromPer100gGrams } from "../openFoodFacts/scaleFromPer100g";
import {
  checkScaledLogPlausibility,
  type ScaledLogPlausibilityResult,
} from "./macroPlausibility";

const GRAMS_PER_OUNCE = 28.3495;

/** Per-100 g label panel used to scale + plausibility-check a portion. */
export type MacrosPer100gPanel = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
};

/** A unit of measurement for one of the picker's selectable axes. */
export type PortionUnit =
  | { kind: "count"; singular: string; plural: string; gramsPerUnit: number }
  | { kind: "serving"; gramsPerServing: number }
  | { kind: "gram" }
  | { kind: "ounce" };

/** Picker state. `amount` is in units of `unit`; grams are derived. */
export interface PortionState {
  amount: number;
  unit: PortionUnit;
}

export interface QuickChip {
  /** Display label, e.g. "1 meatball", "4 meatballs", "100 g". */
  label: string;
  /** State this chip resolves to when tapped. */
  state: PortionState;
}

export interface ProductInput {
  /** Per-serving weight if known. Drives the "serving" unit. */
  servingSizeG?: number | null;
  /** Pre-built portion options from OFF / USDA / etc. */
  servingOptions?: Array<{ label: string; grams: number }> | null;
}

export interface PickerOptions {
  /** Available units; first entry is the preferred default. */
  units: PortionUnit[];
  /** Compact chip row of useful preset states. */
  quickChips: QuickChip[];
  /** Picked default state on first render. */
  initial: PortionState;
}

/** Cheap English pluralizer for count-unit labels (95% case: just +s). */
function pluralize(singular: string): string {
  const s = singular.trim();
  if (!s) return s;
  if (/(s|x|z|ch|sh)$/i.test(s)) return `${s}es`;
  if (/[^aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies`;
  return `${s}s`;
}

/**
 * Parse a serving-option label like `"1 meatball"` or `"1 meatball (~22 g)"`
 * into `{ count, name }`. Returns `null` when the label isn't a
 * count-style entry (e.g. "100 g", "1 oz").
 */
export function parseServingLabel(
  label: string,
): { count: number; name: string } | null {
  const trimmed = label.trim();
  // Strip trailing parenthetical like "(~22 g)" or "(approx 22g)" first.
  const noParens = trimmed.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const match = noParens.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return null;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  const rawName = match[2].trim();
  // Reject pure unit labels — they have their own dedicated PortionUnit.
  if (/^(g|gram|grams|oz|ounce|ounces|ml|milliliter|milliliters)$/i.test(rawName)) {
    return null;
  }
  // Reject the generic "serving"/"servings" alias — handled separately.
  if (/^servings?$/i.test(rawName)) return null;
  return { count, name: rawName };
}

/**
 * Singularise a name like "meatballs" → "meatball" for the unit label.
 * Tiny inverse of `pluralize`; not perfect, but matches the same cases
 * users see in OFF labels.
 */
function singularize(name: string): string {
  const s = name.trim();
  if (/ies$/i.test(s)) return `${s.slice(0, -3)}y`;
  if (/(s|x|z|ch|sh)es$/i.test(s)) return s.slice(0, -2);
  if (/s$/i.test(s) && !/ss$/i.test(s)) return s.slice(0, -1);
  return s;
}

/**
 * Build the picker's options from a product. Returns the unit list,
 * quick-chip row, and initial state. Pure function — safe to call from
 * a `useMemo` in either React tree.
 */
export function buildPickerOptions(
  product: ProductInput,
  opts: { rememberedGrams?: number | null; preferOunce?: boolean } = {},
): PickerOptions {
  const servingOptions = product.servingOptions ?? [];
  const servingSizeG = product.servingSizeG ?? 0;
  const { rememberedGrams, preferOunce = false } = opts;

  // 1) Collect count units. For each singular name, prefer the entry
  //    with the smallest count — that's the canonical "1 X" definition.
  //    e.g. "1 meatball (22 g)" and "4 meatballs (87 g)" both resolve
  //    to singular "meatball"; we use the count=1 entry so
  //    gramsPerUnit = 22 (exact), not 87/4 = 21.75 (drift).
  const countUnitsBySingular = new Map<
    string,
    { gramsPerUnit: number; singular: string; canonicalCount: number }
  >();
  for (const opt of servingOptions) {
    if (!Number.isFinite(opt.grams) || opt.grams <= 0) continue;
    const parsed = parseServingLabel(opt.label);
    if (!parsed) continue;
    const singular = singularize(parsed.name).toLowerCase();
    if (!singular) continue;
    const gramsPerUnit = opt.grams / parsed.count;
    const existing = countUnitsBySingular.get(singular);
    if (!existing || parsed.count < existing.canonicalCount) {
      countUnitsBySingular.set(singular, { gramsPerUnit, singular, canonicalCount: parsed.count });
    }
  }

  const countUnits: PortionUnit[] = Array.from(countUnitsBySingular.values()).map(
    ({ singular, gramsPerUnit }) => ({
      kind: "count" as const,
      singular,
      plural: pluralize(singular),
      gramsPerUnit,
    }),
  );

  // 2) Assemble unit list in order of friendliness: count → serving →
  //    gram → ounce.
  const units: PortionUnit[] = [...countUnits];
  if (servingSizeG > 0) {
    units.push({ kind: "serving", gramsPerServing: servingSizeG });
  }
  units.push({ kind: "gram" });
  if (preferOunce || true) units.push({ kind: "ounce" });

  // 3) Quick chips — keep useful presets sourced from servingOptions
  //    + standard gram fallbacks. Chip labels are derived from the
  //    state via `formatPortion`, not the raw OFF label, so unhelpful
  //    OFF entries like "1 g (~1 g)" can't sneak through.
  const quickChips: QuickChip[] = [];
  const seenSignatures = new Set<string>();
  const pushChip = (state: PortionState, labelOverride?: string) => {
    const sig = `${state.unit.kind}:${state.unit.kind === "count" ? state.unit.singular : ""}:${Math.round(stateToGrams(state) * 100)}`;
    if (seenSignatures.has(sig)) return;
    seenSignatures.add(sig);
    quickChips.push({ label: labelOverride ?? formatPortion(state), state });
  };
  for (const opt of servingOptions) {
    if (!Number.isFinite(opt.grams) || opt.grams <= 0) continue;
    // Skip tiny gram-only servings (e.g. OFF's "1 g" filler entries).
    const parsed = parseServingLabel(opt.label);
    if (parsed) {
      const singular = singularize(parsed.name).toLowerCase();
      const unit = units.find(
        (u): u is Extract<PortionUnit, { kind: "count" }> =>
          u.kind === "count" && u.singular === singular,
      );
      if (unit) {
        pushChip({ amount: parsed.count, unit });
        continue;
      }
    }
    if (opt.grams < 5) continue;
    pushChip({ amount: opt.grams, unit: { kind: "gram" } });
  }
  // Add 1 serving as a chip when a serving size is known.
  if (servingSizeG > 0) {
    pushChip({ amount: 1, unit: { kind: "serving", gramsPerServing: servingSizeG } });
  }
  // Standard fallback grams (only when not already a chip).
  for (const g of [100, 50, 200]) {
    pushChip({ amount: g, unit: { kind: "gram" } });
  }
  // Sort ascending by gram weight so the chip row reads naturally.
  quickChips.sort((a, b) => stateToGrams(a.state) - stateToGrams(b.state));

  // 4) Initial state. Priority: remembered portion → first count unit
  //    at amount=1 → 1 serving → 100 g.
  let initial: PortionState;
  if (rememberedGrams != null && rememberedGrams > 0) {
    // Try to resolve the remembered gram weight back into the most
    // user-friendly unit.
    const countUnit = countUnits.find(
      (u): u is Extract<PortionUnit, { kind: "count" }> => u.kind === "count",
    );
    if (countUnit && countUnit.gramsPerUnit > 0) {
      const count = rememberedGrams / countUnit.gramsPerUnit;
      // If it lands close to a whole number of units, prefer that.
      const nearest = Math.round(count);
      if (Math.abs(count - nearest) < 0.1 && nearest > 0) {
        initial = { amount: nearest, unit: countUnit };
      } else {
        initial = { amount: rememberedGrams, unit: { kind: "gram" } };
      }
    } else if (servingSizeG > 0) {
      const servings = rememberedGrams / servingSizeG;
      const nearestServing = Math.round(servings * 2) / 2; // 0.5 step
      if (Math.abs(servings - nearestServing) < 0.1 && nearestServing > 0) {
        initial = { amount: nearestServing, unit: { kind: "serving", gramsPerServing: servingSizeG } };
      } else {
        initial = { amount: rememberedGrams, unit: { kind: "gram" } };
      }
    } else {
      initial = { amount: rememberedGrams, unit: { kind: "gram" } };
    }
  } else if (countUnits.length > 0) {
    initial = { amount: 1, unit: countUnits[0] };
  } else if (servingSizeG > 0) {
    initial = { amount: 1, unit: { kind: "serving", gramsPerServing: servingSizeG } };
  } else {
    initial = { amount: 100, unit: { kind: "gram" } };
  }

  return { units, quickChips, initial };
}

/** Convert a picker state to grams. */
export function stateToGrams(state: PortionState): number {
  const { amount, unit } = state;
  switch (unit.kind) {
    case "count":
      return amount * unit.gramsPerUnit;
    case "serving":
      return amount * unit.gramsPerServing;
    case "gram":
      return amount;
    case "ounce":
      return amount * GRAMS_PER_OUNCE;
  }
}

/**
 * Switch units while preserving the gram weight. Useful for "I selected
 * 3 meatballs, now show me that in grams".
 */
export function switchUnit(state: PortionState, nextUnit: PortionUnit): PortionState {
  const grams = stateToGrams(state);
  return { amount: gramsToAmount(grams, nextUnit), unit: nextUnit };
}

function gramsToAmount(grams: number, unit: PortionUnit): number {
  switch (unit.kind) {
    case "count":
      return unit.gramsPerUnit > 0 ? grams / unit.gramsPerUnit : 0;
    case "serving":
      return unit.gramsPerServing > 0 ? grams / unit.gramsPerServing : 0;
    case "gram":
      return grams;
    case "ounce":
      return grams / GRAMS_PER_OUNCE;
  }
}

/** Default step size for the +/- stepper depending on unit. */
export function stepperStep(unit: PortionUnit): number {
  switch (unit.kind) {
    case "count":
      return 1;
    case "serving":
      return 0.5;
    case "gram":
      return 5;
    case "ounce":
      return 0.5;
  }
}

/** Round the display amount to a sensible precision for the unit. */
export function roundAmount(amount: number, unit: PortionUnit): number {
  switch (unit.kind) {
    case "count":
      // Keep whole numbers when close; otherwise 1 decimal.
      return Math.abs(amount - Math.round(amount)) < 0.05
        ? Math.round(amount)
        : Math.round(amount * 10) / 10;
    case "serving":
      return Math.round(amount * 10) / 10;
    case "gram":
      return Math.round(amount);
    case "ounce":
      return Math.round(amount * 10) / 10;
  }
}

/** Human display for an amount + unit. */
export function formatPortion(state: PortionState): string {
  const { amount, unit } = state;
  const a = roundAmount(amount, unit);
  switch (unit.kind) {
    case "count":
      return `${a} ${a === 1 ? unit.singular : unit.plural}`;
    case "serving":
      return `${a} ${a === 1 ? "serving" : "servings"}`;
    case "gram":
      return `${a} g`;
    case "ounce":
      return `${a} ${a === 1 ? "oz" : "oz"}`;
  }
}

/** Label for the unit pill ("meatball" / "meatballs" — based on amount). */
export function unitLabel(state: PortionState): string {
  const { amount, unit } = state;
  const a = roundAmount(amount, unit);
  switch (unit.kind) {
    case "count":
      return a === 1 ? unit.singular : unit.plural;
    case "serving":
      return a === 1 ? "serving" : "servings";
    case "gram":
      return "g";
    case "ounce":
      return "oz";
  }
}

export type PortionScalePlausibility = {
  grams: number;
  scaled: ReturnType<typeof scaleFromPer100gGrams>;
  plausibility: ScaledLogPlausibilityResult;
  /** False when scaled macros fail the guard or OFF basis was reconciled. */
  plausible: boolean;
};

/**
 * Scale a per-100 g panel to the current picker state and run the post-
 * scale physical plausibility guard. Shared by web + mobile portion pickers
 * so inline warnings stay in sync with barcode log guards.
 */
export function evaluatePortionScalePlausibility(
  panel: MacrosPer100gPanel,
  state: PortionState,
  opts?: { basisCorrected?: boolean },
): PortionScalePlausibility {
  const grams = stateToGrams(state);
  const scaled = scaleFromPer100gGrams(
    { ...panel, fiberG: panel.fiberG ?? 0 },
    grams,
  );
  const plausibility = checkScaledLogPlausibility(scaled, grams, panel);
  const plausible = plausibility.ok && !opts?.basisCorrected;
  return { grams, scaled, plausibility, plausible };
}

/** User-facing copy when scaled totals look physically implausible. */
export function portionPlausibilityWarning(
  scaled: { calories: number; protein: number },
  grams: number,
): string {
  return `${Math.round(scaled.calories)} kcal and ${Math.round(scaled.protein)} g protein for ${Math.round(grams)} g looks unusually high — this product's label data may be per serving, not per 100 g. Edit the values or amount if they look wrong.`;
}

/**
 * Inline warning for food-search / verify preview panes that scale per-100 g
 * macros without the shared PortionPicker component (ENG-702 follow-up).
 */
export function foodSearchPreviewPlausibilityWarning(
  macrosPer100g: MacrosPer100gPanel | null | undefined,
  scaled: { calories: number; protein: number; carbs?: number; fat?: number } | null,
  totalGrams: number,
): string | null {
  if (!macrosPer100g || !scaled || totalGrams <= 0) return null;
  const plausibility = checkScaledLogPlausibility(
    {
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs ?? 0,
      fat: scaled.fat ?? 0,
    },
    totalGrams,
    macrosPer100g,
  );
  if (plausibility.ok) return null;
  return portionPlausibilityWarning(scaled, totalGrams);
}
