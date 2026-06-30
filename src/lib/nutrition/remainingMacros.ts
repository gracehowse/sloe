/**
 * Remaining macros helper — single source of truth for
 * "how much calories / protein / carbs / fat / fiber are left in
 * the user's daily budget", shared across web and mobile.
 *
 * Pure: no React, no Date, no network, no Supabase. Importing this
 * file from a React Native component is safe.
 *
 * Two operating modes:
 *  • `computeRemaining(targets, consumed)` — today's running tally
 *  • `projectRemaining(targets, consumed, candidate)` — "if I log this,
 *    what's left?" preview for the food-search fit-this-in hint.
 *
 * Rounding: integers for display (we do not want "499.3g carbs left").
 * Over-budget: the displayed value is floored at 0, but the
 * `over*` booleans remain true so the UI can switch to "over" styling
 * and show a signed "+N over" number derived from the same helper.
 */

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional daily fiber target in grams. Omit or pass 0 to hide fiber. */
  fiber?: number;
};

export type MacroConsumed = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional consumed fiber in grams. */
  fiber?: number;
};

export type RemainingMacros = {
  /** kcal remaining, floored at 0. */
  calories: number;
  /** grams protein remaining, floored at 0. */
  protein: number;
  /** grams carbs remaining, floored at 0. */
  carbs: number;
  /** grams fat remaining, floored at 0. */
  fat: number;
  /**
   * Grams fiber remaining, floored at 0. `undefined` when the user has
   * no fiber target (e.g. target 0 / unset). Consumers can branch on
   * this to hide the fiber column entirely.
   */
  fiber?: number;
  overCalories: boolean;
  overProtein: boolean;
  overCarbs: boolean;
  overFat: boolean;
  /** True only when a fiber target exists and it has been exceeded. */
  overFiber: boolean;
  /**
   * Signed deltas (target - consumed) — can be negative. Useful when
   * the UI wants to show "+120 over" without reconstructing the math.
   * Always integers.
   */
  deltas: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** Undefined when there is no fiber target. */
    fiber?: number;
  };
};

/** Clamp negative/NaN values to a safe non-negative integer input. */
function safe(value: number | undefined | null): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value;
}

/** Round to nearest integer; treats undefined as 0. */
function roundInt(value: number): number {
  return Math.round(value);
}

function hasFiberTarget(targets: MacroTargets): boolean {
  return typeof targets.fiber === "number" && targets.fiber > 0;
}

/**
 * Core computation shared by `computeRemaining` and `projectRemaining`.
 * Inputs are clamped to ≥0 before the subtraction so a buggy caller
 * cannot produce `target - (-50) = target+50` left.
 */
function buildRemaining(
  targets: MacroTargets,
  consumed: MacroConsumed,
): RemainingMacros {
  const tCal = safe(targets.calories);
  const tPro = safe(targets.protein);
  const tCarb = safe(targets.carbs);
  const tFat = safe(targets.fat);

  const cCal = safe(consumed.calories);
  const cPro = safe(consumed.protein);
  const cCarb = safe(consumed.carbs);
  const cFat = safe(consumed.fat);

  const deltaCal = roundInt(tCal - cCal);
  const deltaPro = roundInt(tPro - cPro);
  const deltaCarb = roundInt(tCarb - cCarb);
  const deltaFat = roundInt(tFat - cFat);

  const showFiber = hasFiberTarget(targets);
  let deltaFiber: number | undefined;
  let fiberRemaining: number | undefined;
  let overFiber = false;
  if (showFiber) {
    const tFib = safe(targets.fiber);
    const cFib = safe(consumed.fiber);
    deltaFiber = roundInt(tFib - cFib);
    fiberRemaining = Math.max(0, deltaFiber);
    overFiber = cFib > tFib;
  }

  return {
    calories: Math.max(0, deltaCal),
    protein: Math.max(0, deltaPro),
    carbs: Math.max(0, deltaCarb),
    fat: Math.max(0, deltaFat),
    fiber: fiberRemaining,
    overCalories: cCal > tCal,
    overProtein: cPro > tPro,
    overCarbs: cCarb > tCarb,
    overFat: cFat > tFat,
    overFiber,
    deltas: {
      calories: deltaCal,
      protein: deltaPro,
      carbs: deltaCarb,
      fat: deltaFat,
      fiber: deltaFiber,
    },
  };
}

/**
 * Compute what's left of each macro for the day.
 *
 * @param targets user's daily macro targets (calories, P/C/F, optional fiber)
 * @param consumed totals logged so far today
 */
export function computeRemaining(
  targets: MacroTargets,
  consumed: MacroConsumed,
): RemainingMacros {
  return buildRemaining(targets, consumed);
}

/**
 * "If I log this, how much is left?" — used by the food-search
 * fit-this-in preview. Does not mutate `consumed`.
 *
 * @param targets daily targets
 * @param consumed what's already logged today
 * @param candidate the macros of the portion the user is considering
 */
export function projectRemaining(
  targets: MacroTargets,
  consumed: MacroConsumed,
  candidate: MacroConsumed,
): RemainingMacros {
  const projected: MacroConsumed = {
    calories: safe(consumed.calories) + safe(candidate.calories),
    protein: safe(consumed.protein) + safe(candidate.protein),
    carbs: safe(consumed.carbs) + safe(candidate.carbs),
    fat: safe(consumed.fat) + safe(candidate.fat),
  };
  // Only include fiber in the projected total when the target is set —
  // mirrors the behaviour of `buildRemaining` so the returned shape is
  // identical whether or not fiber is tracked.
  if (hasFiberTarget(targets)) {
    projected.fiber = safe(consumed.fiber) + safe(candidate.fiber);
  }
  return buildRemaining(targets, projected);
}

/* ------------------------------------------------------------------ *
 * solvePortionToFit (ENG-854) — "how much of THIS fits what's left?"  *
 * ------------------------------------------------------------------ */

/**
 * Which macro stopped us from logging more — the one whose remaining
 * budget floored the portion. `calories` is the default and most common
 * binding macro; protein/carbs/fat/fiber surface when a macro target is
 * the tighter constraint (e.g. a fatty food on a low-fat day binds on
 * `fat`, not calories).
 */
export type BindingMacro = "calories" | "protein" | "carbs" | "fat" | "fiber";

/**
 * Per-unit macro basis: the macros of ONE unit of the thing being scaled.
 * For a per-100g food this is the macros of 100 g (and `naturalUnit` is
 * the gram weight of one display unit, e.g. 28.35 for an ounce); for a
 * per-serving food it's the macros of one serving.
 */
export type PortionMacroBasis = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional — only constrains the solve when the user tracks fiber. */
  fiber?: number;
};

/** How the basis scales to a user-facing quantity. */
export type NaturalUnit =
  | {
      /**
       * Per-100g food. `gramWeight` is the grams in one display unit
       * (1 for "g", 28.35 for "oz", 0 for a per-serving food with no
       * metric grounding — which forces the qualitative fallback).
       * The basis is per-100g, so a portion of `grams` grams contributes
       * `basis × grams / 100`.
       */
      kind: "per100g";
      gramWeight: number;
    }
  | {
      /**
       * Per-serving / per-unit food (FatSecret "1 large tomato",
       * "8 pieces"). The basis is per-one-unit; a quantity of N units
       * contributes `basis × N`. `gramWeight` is informational only.
       */
      kind: "perUnit";
      gramWeight: number;
    };

/**
 * Confidence in the count-to-weight grounding of this food. Low confidence
 * (no gram weight, or an explicitly low tier) means we MUST NOT print a
 * fake gram/serving number — we return a qualitative fallback instead.
 * Accepts the `SearchRowConfidenceTier` union ("verified" | "estimated")
 * plus a coarse "low" / "high" for callers that only know "we're (not) sure".
 */
export type PortionConfidence = "verified" | "estimated" | "low" | "high";

export type SolvePortionResult =
  | {
      /**
       * We have enough confidence + grounding to name a concrete portion.
       * `quantity` is in the natural unit (grams for per100g, units for
       * perUnit); `binding` is the macro that floored it.
       */
      kind: "quantified";
      /** Largest quantity (rounded down to display granularity) that still fits. */
      quantity: number;
      /** Unit the quantity is expressed in: "g" for per100g, "unit" otherwise. */
      unit: "g" | "unit";
      /** The macro that floored the portion first. */
      binding: BindingMacro;
      /** kcal in the solved portion (rounded) — for the body-neutral copy. */
      calories: number;
      /** True when even a minimal portion overshoots — nothing fits. */
      none: boolean;
    }
  | {
      /**
       * Low confidence / no metric grounding — we deliberately refuse to
       * invent a gram number. Callers render a qualitative line instead.
       */
      kind: "qualitative";
      /** The macro that's tightest, so copy can still say "limited by carbs". */
      binding: BindingMacro;
      /** Why we couldn't quantify — drives which qualitative copy shows. */
      reason: "low-confidence" | "no-grounding";
    };

const MACRO_KEYS: BindingMacro[] = ["calories", "protein", "carbs", "fat", "fiber"];

/** Remaining budget for a single macro, treating fiber as absent when not tracked. */
function remainingFor(
  macro: BindingMacro,
  targets: MacroTargets,
  consumed: MacroConsumed,
): number | null {
  if (macro === "fiber" && !hasFiberTarget(targets)) return null;
  const t = safe(targets[macro]);
  const c = safe(consumed[macro]);
  return t - c; // can be negative when already over
}

/** Per-display-unit macro contribution for the natural unit. */
function perUnitContribution(
  macro: BindingMacro,
  basis: PortionMacroBasis,
  naturalUnit: NaturalUnit,
): number {
  const raw = macro === "fiber" ? safe(basis.fiber) : safe(basis[macro]);
  if (naturalUnit.kind === "per100g") {
    // basis is per 100 g; one gram contributes raw/100.
    return raw / 100;
  }
  // perUnit: basis is already per one unit.
  return raw;
}

function isLowConfidence(confidence: PortionConfidence): boolean {
  return confidence === "low" || confidence === "estimated";
}

/**
 * Solve for the LARGEST portion of a candidate food whose projected
 * remaining macros all stay ≥ 0, and name the macro that floored it.
 *
 * Because every macro scales linearly with quantity, the per-macro cap is
 * closed-form — `cap_macro = remaining_macro / perUnit_macro` — and the
 * binding macro is the argmin across all tracked macros (the one that
 * floors first). No iterative search is needed; the closed-form min is
 * exact, and we default the binding to `calories` on ties so the common
 * case reads "limited by calories" rather than an arbitrary macro.
 *
 * NUTRITION-TRUST RULE (non-negotiable, ENG-854): when the food has no
 * metric grounding (`naturalUnit.gramWeight === 0`) or a low confidence
 * tier, we return a `qualitative` result and NEVER a fabricated gram /
 * serving number. "About this much" is honest; "220 g" off a guessed
 * weight is a fake.
 *
 * @param targets    daily macro targets
 * @param consumed   what's already logged today
 * @param basis      per-100g OR per-one-unit macros of the candidate
 * @param naturalUnit how `basis` scales (per100g grams, or per-unit) + grounding
 * @param confidence count-to-weight confidence tier for this food
 */
export function solvePortionToFit(
  targets: MacroTargets,
  consumed: MacroConsumed,
  basis: PortionMacroBasis,
  naturalUnit: NaturalUnit,
  confidence: PortionConfidence,
): SolvePortionResult {
  // Determine the tightest macro regardless of grounding, so even the
  // qualitative fallback can say "limited by carbs". We compute the cap
  // (remaining / perUnit) for every tracked macro; the smallest cap binds.
  let binding: BindingMacro = "calories";
  let smallestCap = Number.POSITIVE_INFINITY;

  for (const macro of MACRO_KEYS) {
    const remaining = remainingFor(macro, targets, consumed);
    if (remaining == null) continue; // fiber not tracked
    const perUnit = perUnitContribution(macro, basis, naturalUnit);
    if (perUnit <= 0) continue; // this macro never constrains (no contribution)
    // Negative remaining → cap is negative → this macro is already over.
    const cap = remaining / perUnit;
    // Strictly-smaller wins; on a tie we keep the earlier macro, and since
    // calories is first in MACRO_KEYS it naturally wins ties.
    if (cap < smallestCap) {
      smallestCap = cap;
      binding = macro;
    }
  }

  // No macro contributes anything (all perUnit ≤ 0) — degenerate food.
  // There's no meaningful portion to solve; treat as qualitative so we
  // never claim "you can log unlimited grams".
  const noConstrainingMacro = !Number.isFinite(smallestCap);

  // NUTRITION-TRUST GATE — refuse to print a gram number we can't ground.
  if (naturalUnit.gramWeight === 0 || isLowConfidence(confidence)) {
    return {
      kind: "qualitative",
      binding,
      reason: naturalUnit.gramWeight === 0 ? "no-grounding" : "low-confidence",
    };
  }

  if (noConstrainingMacro) {
    return { kind: "qualitative", binding, reason: "no-grounding" };
  }

  // Closed-form max quantity, floored at 0 (already-over → nothing fits).
  const rawQuantity = Math.max(0, smallestCap);
  // Display granularity: whole grams for per100g, 0.1 units for per-unit
  // (so "0.5 servings fits" reads naturally). Floor — never round UP past
  // the budget, which would tip the binding macro over.
  const quantity =
    naturalUnit.kind === "per100g"
      ? Math.floor(rawQuantity)
      : Math.floor(rawQuantity * 10) / 10;

  // kcal in the solved portion, for the copy ("a 220 g serving fits…").
  const kcalPerUnit = perUnitContribution("calories", basis, naturalUnit);
  const calories = roundInt(kcalPerUnit * quantity);

  return {
    kind: "quantified",
    quantity,
    unit: naturalUnit.kind === "per100g" ? "g" : "unit",
    binding,
    calories,
    none: quantity <= 0,
  };
}

/** Human label for a binding macro, for the "(limited by …)" suffix. */
const BINDING_LABEL: Record<BindingMacro, string> = {
  calories: "calories",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  fiber: "fibre",
};

/**
 * Body-neutral copy for the portion-fit hint, shared verbatim across web +
 * mobile so the two panels can't drift. Returns `null` when there's nothing
 * useful to say (no result). Tone is calm and permission-giving — never
 * shaming, never prescriptive (trust posture).
 *
 * Examples:
 *  • quantified, calories binding → "A 220 g serving fits your remaining 540 kcal."
 *  • quantified, macro binding    → "About 2 servings fits — limited by carbs."
 *  • quantified, none fits        → "This doesn't fit what's left today — but it's your call."
 *  • qualitative                  → "This can fit — adjust the amount to match what's left."
 */
export function portionFitHintCopy(
  result: SolvePortionResult | null,
  remainingCalories: number,
): string | null {
  if (!result) return null;

  if (result.kind === "qualitative") {
    // No grounded gram number — stay qualitative, never invent a quantity.
    return "This can fit — adjust the amount to match what's left.";
  }

  if (result.none) {
    return "This doesn't fit what's left today — but it's your call.";
  }

  const amount =
    result.unit === "g"
      ? `${result.quantity} g`
      : `${result.quantity} ${result.quantity === 1 ? "serving" : "servings"}`;

  if (result.binding === "calories") {
    const kcalLeft = Math.max(0, Math.round(remainingCalories));
    return `A ${amount} serving fits your remaining ${kcalLeft} kcal.`;
  }

  return `About ${amount} fits — limited by ${BINDING_LABEL[result.binding]}.`;
}

/**
 * Subset of the food-search preview state the portion-fit hint needs.
 * Both `FoodSearchPanel`s pass this so the "derive solver inputs from a
 * preview + render copy" logic lives here once (keeps the screen-budget-
 * pinned panels net-neutral — a single call site, no per-platform drift).
 */
export type PortionFitPreview = {
  macrosPer100g: PortionMacroBasis | null;
  macrosPerServing?: PortionMacroBasis | null;
  microsPer100g?: Record<string, number>;
  microsPerServing?: Record<string, number>;
  chosenPortion: { gramWeight: number };
};

/**
 * End-to-end portion-fit hint for a food-search preview: picks the per-serving
 * vs per-100g basis, runs `solvePortionToFit`, and formats the body-neutral
 * copy. Returns `null` when there's nothing to show (no targets, no preview,
 * no usable basis). The per-serving branch passes the no-grounding
 * (`gramWeight 0`) natural unit, so the solver returns the qualitative
 * fallback rather than a fabricated count — the trust rule holds here too.
 */
export function portionFitHintForPreview(
  targets: MacroTargets | undefined,
  consumed: MacroConsumed | undefined,
  preview: PortionFitPreview | null | undefined,
): string | null {
  if (!targets || !consumed || !preview) return null;
  const perServing = preview.macrosPerServing ?? null;
  const per100g = preview.macrosPer100g ?? null;
  const usePerServing =
    Boolean(perServing) && preview.chosenPortion.gramWeight === 0;

  let result: SolvePortionResult | null = null;
  if (usePerServing) {
    result = solvePortionToFit(
      targets,
      consumed,
      { ...perServing!, fiber: preview.microsPerServing?.fiberG },
      { kind: "perUnit", gramWeight: preview.chosenPortion.gramWeight },
      // No metric grounding (gramWeight 0) — solver returns qualitative.
      "estimated",
    );
  } else if (per100g) {
    result = solvePortionToFit(
      targets,
      consumed,
      { ...per100g, fiber: preview.microsPer100g?.fiberG },
      { kind: "per100g", gramWeight: preview.chosenPortion.gramWeight },
      "verified",
    );
  }

  // Current remaining kcal (before this portion) for the copy — "fits your
  // remaining 540 kcal" describes today's headroom, not the projected
  // leftover after the solved portion.
  const remainingNow = computeRemaining(targets, consumed);
  return portionFitHintCopy(result, remainingNow.calories);
}
