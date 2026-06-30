/**
 * Make-anything-fit · Mode B — distribute-around-anchor (ENG-855).
 *
 * The proactive Plan-tab half of the make-anything-fit engine (spec:
 * docs/specs/2026-06-02-make-anything-fit-engine.md). Sibling of Mode A
 * (ENG-854, `solvePortionToFit` in `remainingMacros.ts`): same engine,
 * different surface.
 *
 *   Mode A (Today): "given what's left, how much of THIS fits right now?"
 *   Mode B (Plan):  "if I commit to THIS meal, what's my budget for the
 *                    rest of the day?"
 *
 * When the user drops a meal they *want* into the plan grid (the **anchor**),
 * we subtract it from the day's remaining budget and spread the remainder
 * across the other open slots — turning each open slot into a per-slot
 * calorie + macro target that then scopes its what-to-eat-next suggestions.
 *
 * Worked example (Grace's): drop an 800 kcal dinner into a 2000 kcal day
 * with nothing else logged → ~1200 kcal spreads across breakfast + lunch +
 * snacks by slot weight (≈ breakfast 480 / lunch 570 / snacks 150 before
 * floors), and each slot's budget now scopes its suggestions. Macros, not
 * just calories: a high-fat anchor pushes the other slots leaner, not just
 * smaller.
 *
 * Pure: no React, no Date, no network, no Supabase. Importing this file
 * from a React Native component is safe (shared verbatim web ↔ mobile via
 * `@suppr/shared/nutrition/distributeAroundAnchor`, the single source of
 * truth for the distribution math + body-neutral copy).
 *
 * NUTRITION-TRUST RULE (non-negotiable, per CLAUDE.md): never fabricate a
 * per-slot number off a low-confidence anchor. When the anchor's macros are
 * low-confidence (an estimated split with no real P/C/F), we degrade to a
 * QUALITATIVE result and never print "Aim ~480 kcal". "Here's roughly how
 * the day shakes out" is honest; a precise number off a guessed macro split
 * is a fake.
 *
 * FRAMING RULE (positioning, per the spec's failure-mode #1): every output
 * is framed as ENABLING the wanted food ("to make room for X"), never as a
 * deficit instruction ("eat less"). Copy is body-neutral throughout —
 * permission, not prescription. Optional slots (Snacks) never get a named
 * aim (mirrors `emptySlotAimKcal`'s policy — a number on a slot the user
 * may skip reads as a quota to fill).
 */

import type { MacroTargets, MacroConsumed } from "./remainingMacros";

/**
 * Slot calorie/macro WEIGHTS — the same dietitian shares the planner uses
 * (`SLOT_WEIGHTS` in mealPlanAlgo, `MEAL_SLOT_CALORIE_RATIOS` in mealBudget),
 * so a Mode-B per-slot budget is consistent with what the planner would
 * target for that slot. Keyed lowercase; an unknown / numbered slot ("Meal 5")
 * falls back to an even share via `weightFor`.
 */
const SLOT_WEIGHTS: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.35,
  snack: 0.1,
  snacks: 0.1,
};

/** Optional eating occasions never show a named aim — a number on a slot the
 *  user may deliberately skip reads as a quota to fill (diet-culture /
 *  ED-adjacent). Mirrors `OPTIONAL_AIM_SLOTS` in mealSlotAim.ts so Mode B and
 *  the empty-slot aims can't drift on policy. Snacks stays in the WEIGHTS (so
 *  it still absorbs budget and keeps the named meals' aims honest), it just
 *  never surfaces its own "Aim ~X". */
const OPTIONAL_AIM_SLOTS = new Set(["snacks", "snack"]);

/**
 * Per-slot calorie FLOOR — below this we will not hand a slot a real budget
 * (the spec's failure-mode #3: never propose a 120 kcal dinner to make the
 * math work). A slot whose share falls below the floor is reported as
 * `tooTight` so the UI can say "lunch barely has room" honestly, rather than
 * hiding the squeeze inside an implausible number. 150 kcal ≈ a small snack;
 * a *meal* slot under it is not a real meal.
 */
export const MODE_B_SLOT_FLOOR_KCAL = 150;

/** The anchor meal the user committed to: its macros + which slot it occupies. */
export type AnchorMeal = {
  /** Canonical slot the anchor sits in (Breakfast/Lunch/Dinner/Snacks/Meal N). */
  slot: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional — only distributed when the user tracks fibre. */
  fiber?: number;
  /**
   * Confidence in the anchor's macros. `estimated` / `low` means the P/C/F
   * came from a neutral split with no real grounding (e.g. kcal-only recipe
   * coerced to 28/42/30) — we MUST NOT print precise per-slot numbers off it.
   * Mirrors `PortionConfidence` from Mode A.
   */
  confidence?: "verified" | "estimated" | "low" | "high";
};

/** A single open slot's resulting budget after the anchor is subtracted. */
export type SlotBudget = {
  /** Canonical slot name (as passed in). */
  slot: string;
  /** kcal budget for this slot, floored at 0 and rounded. */
  calories: number;
  /** grams protein budget, floored at 0, rounded. */
  protein: number;
  /** grams carbs budget, floored at 0, rounded. */
  carbs: number;
  /** grams fat budget, floored at 0, rounded. */
  fat: number;
  /** grams fibre budget — undefined when the user has no fibre target. */
  fiber?: number;
  /**
   * True when this slot's calorie share fell below {@link MODE_B_SLOT_FLOOR_KCAL}
   * — the anchor left too little for a real meal here. The UI surfaces this as
   * honesty ("lunch barely has room"), never as a fabricated tiny number.
   */
  tooTight: boolean;
  /**
   * True for optional slots (Snacks) — they keep a numeric budget for
   * suggestion-scoping but the UI suppresses their *named aim* (no "Aim ~X"),
   * mirroring `emptySlotAimKcal`.
   */
  optional: boolean;
};

export type DistributeAroundAnchorResult =
  | {
      /**
       * We had enough confidence + headroom to name real per-slot budgets.
       * `slots` is one entry per open slot, in the order passed in.
       */
      kind: "distributed";
      slots: SlotBudget[];
      /** kcal left for the open slots after the anchor (floored at 0, rounded). */
      remainingCalories: number;
      /**
       * True when the anchor (plus anything already logged) leaves so little
       * that EVERY open meal slot is below the floor — the day genuinely can't
       * absorb the anchor without skipping meals. The UI states this plainly
       * rather than proposing implausible slots.
       */
      anchorLeavesTooLittle: boolean;
    }
  | {
      /**
       * Low-confidence anchor — we deliberately refuse to invent per-slot
       * numbers off a guessed macro split. The UI renders a qualitative line
       * ("here's roughly how the rest of the day shakes out") instead.
       */
      kind: "qualitative";
      reason: "low-confidence";
    };

/** Clamp negative / non-finite values to a safe non-negative number. */
function safe(value: number | undefined | null): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value;
}

function hasFiberTarget(targets: MacroTargets): boolean {
  return typeof targets.fiber === "number" && targets.fiber > 0;
}

function isLowConfidence(confidence: AnchorMeal["confidence"]): boolean {
  return confidence === "low" || confidence === "estimated";
}

function isOptionalSlot(slot: string): boolean {
  return OPTIONAL_AIM_SLOTS.has(slot.trim().toLowerCase());
}

/** Dietitian weight for a slot; unknown / numbered slots get an even 1/N share. */
function weightFor(slot: string, openSlots: readonly string[]): number {
  const known = SLOT_WEIGHTS[slot.trim().toLowerCase()];
  if (typeof known === "number") return known;
  // Even share for numbered / unknown slots, mirroring evenSlotCalorieRatio.
  return openSlots.length > 0 ? 1 / openSlots.length : 0;
}

/**
 * Distribute the day's REMAINING budget (after the anchor + anything already
 * logged) across the open slots, by dietitian weight, into per-slot calorie +
 * macro targets.
 *
 * Math (per-macro, identical shape to `distributeMealBudget` but anchor-aware):
 *   remaining_macro = day_target_macro − consumed_macro − anchor_macro   (≥0)
 *   slot_macro      = remaining_macro × (slot_weight / Σ open_slot_weights)
 *
 * Every macro is distributed independently with the same weights, so a high-fat
 * anchor leaves a smaller *fat* remainder → the open slots come out leaner on
 * fat, not merely smaller on calories (the spec's "macros, not just calories").
 *
 * Floors (failure-mode #3): a slot whose calorie share < {@link MODE_B_SLOT_FLOOR_KCAL}
 * is flagged `tooTight`; we keep its (small, honest) numeric budget for
 * suggestion-scoping but the UI must treat the flag as the signal, not the
 * number. When EVERY open meal slot is below the floor, `anchorLeavesTooLittle`
 * is true and the copy says so plainly.
 *
 * NUTRITION-TRUST GATE: a low-confidence anchor → `qualitative` result, never
 * fabricated per-slot numbers.
 *
 * @param targets   the day's macro targets (calories, P/C/F, optional fibre)
 * @param consumed  totals already logged today (across all slots)
 * @param anchor    the meal the user committed to + its slot + confidence
 * @param openSlots the still-open slots to distribute across (anchor slot is
 *                  removed if present; duplicates de-duped, order preserved)
 */
export function distributeAroundAnchor(
  targets: MacroTargets,
  consumed: MacroConsumed,
  anchor: AnchorMeal,
  openSlots: readonly string[],
): DistributeAroundAnchorResult {
  // NUTRITION-TRUST GATE — refuse to print per-slot numbers off a guessed split.
  if (isLowConfidence(anchor.confidence)) {
    return { kind: "qualitative", reason: "low-confidence" };
  }

  // The anchor's own slot is not an "open" slot to distribute into. De-dupe and
  // preserve order so the result lines up with the caller's slot list.
  const anchorSlotLc = anchor.slot.trim().toLowerCase();
  const seen = new Set<string>();
  const slots = openSlots.filter((s) => {
    const lc = s.trim().toLowerCase();
    if (!lc || lc === anchorSlotLc || seen.has(lc)) return false;
    seen.add(lc);
    return true;
  });

  // Remaining budget per macro = day target − consumed − anchor, floored at 0
  // (no-negative invariant: an over-budget anchor can never hand a slot a
  // negative target, and can never inflate another macro).
  const remCalories = Math.max(
    0,
    safe(targets.calories) - safe(consumed.calories) - safe(anchor.calories),
  );
  const remProtein = Math.max(
    0,
    safe(targets.protein) - safe(consumed.protein) - safe(anchor.protein),
  );
  const remCarbs = Math.max(
    0,
    safe(targets.carbs) - safe(consumed.carbs) - safe(anchor.carbs),
  );
  const remFat = Math.max(
    0,
    safe(targets.fat) - safe(consumed.fat) - safe(anchor.fat),
  );

  const trackFiber = hasFiberTarget(targets);
  const remFiber = trackFiber
    ? Math.max(0, safe(targets.fiber) - safe(consumed.fiber) - safe(anchor.fiber))
    : undefined;

  // Sum of weights over the OPEN slots (the anchor slot is excluded), so the
  // remainder spreads only across the slots still to be filled.
  const totalWeight = slots.reduce((sum, s) => sum + weightFor(s, slots), 0);

  const slotBudgets: SlotBudget[] = slots.map((slot) => {
    const w = totalWeight > 0 ? weightFor(slot, slots) / totalWeight : 0;
    const calories = Math.round(remCalories * w);
    const optional = isOptionalSlot(slot);
    return {
      slot,
      calories,
      protein: Math.round(remProtein * w),
      carbs: Math.round(remCarbs * w),
      fat: Math.round(remFat * w),
      fiber: remFiber != null ? Math.round(remFiber * w) : undefined,
      // Optional slots (Snacks) are *expected* to be small — a sub-floor snack
      // is not "too tight", it's just a snack — so the floor check skips them.
      tooTight: !optional && calories < MODE_B_SLOT_FLOOR_KCAL,
      optional,
    };
  });

  // Every NON-optional open slot below the floor → the anchor genuinely can't
  // fit without skipping meals. (If there are no non-optional open slots, the
  // anchor is the whole day — not "too little", just a single-meal day.)
  const mealSlots = slotBudgets.filter((s) => !s.optional);
  const anchorLeavesTooLittle =
    mealSlots.length > 0 && mealSlots.every((s) => s.tooTight);

  return {
    kind: "distributed",
    slots: slotBudgets,
    remainingCalories: Math.round(remCalories),
    anchorLeavesTooLittle,
  };
}

/** Human label for a slot in the summary copy. Lowercased mid-sentence. */
function slotLabel(slot: string): string {
  return slot.trim().toLowerCase();
}

/** Join slot names into a natural-language list ("breakfast and lunch", or
 *  "breakfast, lunch and snacks"). */
function joinSlots(slots: string[]): string {
  if (slots.length === 0) return "";
  if (slots.length === 1) return slots[0];
  if (slots.length === 2) return `${slots[0]} and ${slots[1]}`;
  return `${slots.slice(0, -1).join(", ")} and ${slots[slots.length - 1]}`;
}

/**
 * Body-neutral summary copy for a Mode-B distribution, shared verbatim across
 * web + mobile so the two Plan hosts can't drift. Returns `null` when there's
 * nothing useful to say.
 *
 * Tone is permission-giving and ENABLING (failure-mode #1): every line frames
 * the distribution as making room for the anchor the user *wants*, never as a
 * deficit instruction. Examples:
 *   • distributed → "Spag bol's in for dinner — here's how breakfast and lunch shake out."
 *   • too little   → "Spag bol fills most of today — the other slots barely have room, but it's your call."
 *   • qualitative  → "Spag bol's in for dinner — here's roughly how the rest of the day shakes out."
 *
 * @param result     the distribution result
 * @param anchorName a short name for the anchor meal ("Spag bol", "the cake")
 * @param anchorSlot the slot the anchor sits in (for the "in for dinner" clause)
 */
export function distributeAroundAnchorCopy(
  result: DistributeAroundAnchorResult | null,
  anchorName: string,
  anchorSlot: string,
): string | null {
  if (!result) return null;
  const name = anchorName.trim() || "That meal";
  const slot = slotLabel(anchorSlot);

  if (result.kind === "qualitative") {
    return `${name}'s in for ${slot} — here's roughly how the rest of the day shakes out.`;
  }

  if (result.anchorLeavesTooLittle) {
    return `${name} fills most of today — the other slots barely have room, but it's your call.`;
  }

  // Name only the NON-optional slots that still have a real budget (a slot the
  // anchor occupies isn't in the list; optional Snacks isn't named as an aim).
  const named = result.slots
    .filter((s) => !s.optional && !s.tooTight && s.calories > 0)
    .map((s) => slotLabel(s.slot));

  if (named.length === 0) {
    // Nothing concrete to name (e.g. only an optional slot left) — stay honest.
    return `${name}'s in for ${slot} — the rest of the day's yours.`;
  }

  return `${name}'s in for ${slot} — here's how ${joinSlots(named)} shake${
    named.length === 1 ? "s" : ""
  } out.`;
}

/* ------------------------------------------------------------------ *
 * Plan-host selector — derive a Mode-B band from a day plan.           *
 *                                                                      *
 * Keeps the screen-budget-PINNED hosts (MealPlanner.tsx web,           *
 * planner.tsx mobile) net-neutral: the host passes its already-in-     *
 * scope per-day data, this selector does ALL the "what's the anchor /  *
 * what's open / run the engine / format the copy" work, and the host   *
 * renders a single child band. Single call site → no per-platform      *
 * drift in the anchor/slot derivation.                                 *
 * ------------------------------------------------------------------ */

/** The slice of a planned-day meal the selector needs. Matches both web
 *  `DayPlanMeal` and mobile `PlanMeal` (structural — no import coupling). */
export type PlanDayMealLike = {
  /** Slot literal — "Breakfast" / "Lunch" / "Dinner" / "Snacks" / "Meal N". */
  name: string;
  recipeTitle?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  /** Per-slot portion scale; the anchor's macros are scaled by this. */
  portionMultiplier?: number;
  /** Open slot — no real meal placed yet (distribute INTO these). */
  isPlaceholder?: boolean;
  /** Committed "I want this" meal — the Mode-B anchor. */
  isLocked?: boolean;
  /** kcal-only coerced (neutral 28/42/30) → low confidence; gates the trust rule. */
  macrosAreEstimated?: boolean;
};

export type PlanDayDistribution = {
  /** The engine result for the anchored day. */
  result: DistributeAroundAnchorResult;
  /** Body-neutral summary line (already formatted), or null. */
  copy: string | null;
  /** The slot the anchor sits in (for the host to anchor the band visually). */
  anchorSlot: string;
};

/** Scale a meal's macros by its portion multiplier (default 1). */
function scaled(meal: PlanDayMealLike): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
} {
  const mult = Number.isFinite(meal.portionMultiplier) ? Number(meal.portionMultiplier) : 1;
  const m = mult > 0 ? mult : 1;
  return {
    calories: safe(meal.calories) * m,
    protein: safe(meal.protein) * m,
    carbs: safe(meal.carbs) * m,
    fat: safe(meal.fat) * m,
    fiber: meal.fiberG != null ? safe(meal.fiberG) * m : undefined,
  };
}

/**
 * Derive a Mode-B distribution for a planned day. The **anchor** is the
 * LOCKED, non-placeholder meal the user committed to (`isLocked === true`);
 * everything else placed (non-placeholder, non-locked) is treated as
 * already-consumed budget; placeholder slots are the OPEN slots to distribute
 * into. Returns `null` when there is no anchor (nothing to plan around) or no
 * open slot to distribute into (nothing to say) — so the host renders the band
 * only when Mode B has something useful to add.
 *
 * Confidence: if the anchor's macros are estimated (`macrosAreEstimated`), the
 * engine returns a qualitative result and the copy never names per-slot numbers
 * — the nutrition-trust rule, end to end.
 *
 * @param meds    the day's meals (placed + placeholders), in slot order
 * @param targets the day's macro targets
 * @param anchorName optional override for the anchor's display name (defaults to
 *                its recipe title)
 */
export function planDayDistributeAroundAnchor(
  meals: readonly PlanDayMealLike[],
  targets: MacroTargets,
): PlanDayDistribution | null {
  if (!(safe(targets.calories) > 0)) return null;

  const anchorMeal = meals.find((m) => m.isLocked && !m.isPlaceholder);
  if (!anchorMeal) return null;

  // Open slots = placeholder slots (and the anchor slot is excluded inside the
  // engine). De-dupe is handled by the engine.
  const openSlots = meals
    .filter((m) => m.isPlaceholder)
    .map((m) => m.name);
  if (openSlots.length === 0) return null;

  // Other PLACED meals (not the anchor, not placeholders) count as consumed.
  const consumed: MacroConsumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let consumedFiber = 0;
  let anyConsumedFiber = false;
  for (const m of meals) {
    if (m === anchorMeal || m.isPlaceholder) continue;
    const s = scaled(m);
    consumed.calories += s.calories;
    consumed.protein += s.protein;
    consumed.carbs += s.carbs;
    consumed.fat += s.fat;
    if (s.fiber != null) {
      consumedFiber += s.fiber;
      anyConsumedFiber = true;
    }
  }
  if (anyConsumedFiber) consumed.fiber = consumedFiber;

  const anchorScaled = scaled(anchorMeal);
  const anchor: AnchorMeal = {
    slot: anchorMeal.name,
    calories: anchorScaled.calories,
    protein: anchorScaled.protein,
    carbs: anchorScaled.carbs,
    fat: anchorScaled.fat,
    fiber: anchorScaled.fiber,
    confidence: anchorMeal.macrosAreEstimated ? "estimated" : "verified",
  };

  const result = distributeAroundAnchor(targets, consumed, anchor, openSlots);
  const name = (anchorMeal.recipeTitle ?? "").trim() || "That meal";
  const copy = distributeAroundAnchorCopy(result, name, anchorMeal.name);

  return { result, copy, anchorSlot: anchorMeal.name };
}
