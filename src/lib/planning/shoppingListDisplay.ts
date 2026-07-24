/**
 * Shopping-list DISPLAY formatting — one implementation shared by web
 * (`src/app/components/ShoppingList.tsx`, `shopping/ShoppingListRow.tsx`) and
 * mobile (`apps/mobile/app/shopping.tsx`,
 * `components/shopping/ShoppingListGroupRow.tsx`, imported through
 * `@suppr/shared/planning/shoppingListDisplay`).
 *
 * SCOPE — presentation only, and deliberately so. Nothing in this file
 * mutates, re-aggregates, or persists a stored shopping/nutrition value:
 * every helper takes an already-formatted label (or a plain count) and
 * returns a different STRING. Recipe detail, ingredient matching and every
 * nutrition total keep the exact source grams. The shopping list is the one
 * surface that must speak in what a shop actually sells, which is why the
 * rounding lives here at the view edge and nowhere deeper.
 */

/* ------------------------------------------------------------------ *
 * 1. Purchasable quantities
 * ------------------------------------------------------------------ */

/**
 * The marker printed instead of a fabricated weight when the amount falls
 * below the smallest quantity a shop sells (a 1 g / 2.5 g spice reading).
 * "to taste" is the standard recipe idiom for "there is no purchasable unit
 * this small — buy the smallest pack", and it is honest in a way that
 * inventing "25 g" is not.
 */
export const SHOPPING_QUALITATIVE_LABEL = "to taste";

export type PurchasableShoppingQuantity =
  /** No quantity to show — the row is name-only. */
  | { kind: "none" }
  /** A real, buyable amount ("700 g", "2 heads", "1.5 kg + 2 tin"). */
  | { kind: "amount"; text: string }
  /**
   * Below every purchasable step — see `SHOPPING_QUALITATIVE_LABEL`.
   * `exact` is the untouched requirement ("2.5 g"), surfaced in the row caption
   * so suppressing the number from the amount slot never hides it outright.
   * "to taste" is right for oregano and wrong for saffron or yeast; the caption
   * is what keeps the second case honest.
   */
  | { kind: "qualitative"; text: string; exact: string };

type ShopUnitRule = {
  /**
   * Amounts strictly below this are not purchasable in their own right.
   * `0` disables the floor (counts — half a lemon is not a thing, but one is).
   */
  floor: number;
  /** Ordered `[appliesBelow, step]` pairs, first match wins. */
  steps: ReadonlyArray<readonly [number, number]>;
  /** Step used above every `steps` threshold. */
  fallbackStep: number;
};

/**
 * Shop-unit rounding table. Every rule rounds **up**: over-buying a little is
 * a non-event, under-buying breaks the recipe you planned. Units not listed
 * (heads, cloves, bunch, tin, jar, and bare counts) fall through to
 * `COUNT_RULE`.
 *
 *   g / ml   floor 5    · <100 → 5s · <1000 → 25s · else 50s
 *   kg / l   floor 0.05 · 0.05s
 *   oz       floor 0.5  · 0.5s
 *   lb       floor 0.25 · 0.25s
 *   tsp/tbsp/cup  floor 0.25 · 0.25s   (measuring-spoon steps)
 *   counts   no floor   · whole units
 */
const UNIT_RULES: Readonly<Record<string, ShopUnitRule>> = {
  g: { floor: 5, steps: [[100, 5], [1000, 25]], fallbackStep: 50 },
  ml: { floor: 5, steps: [[100, 5], [1000, 25]], fallbackStep: 50 },
  kg: { floor: 0.05, steps: [], fallbackStep: 0.05 },
  l: { floor: 0.05, steps: [], fallbackStep: 0.05 },
  oz: { floor: 0.5, steps: [], fallbackStep: 0.5 },
  lb: { floor: 0.25, steps: [], fallbackStep: 0.25 },
  tsp: { floor: 0.25, steps: [], fallbackStep: 0.25 },
  tbsp: { floor: 0.25, steps: [], fallbackStep: 0.25 },
  cup: { floor: 0.25, steps: [], fallbackStep: 0.25 },
};

/** Counts and shop nouns — you cannot buy 1.4 heads of broccoli. */
const COUNT_RULE: ShopUnitRule = { floor: 0, steps: [], fallbackStep: 1 };

function roundUpToStep(value: number, step: number): number {
  // The epsilon keeps an exact multiple (800 / 25) from jumping a whole step
  // on binary-float noise.
  const raised = Math.ceil(value / step - 1e-9) * step;
  return Number(raised.toFixed(4));
}

function formatQuantityNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

type PurchasableToken = { text: string; belowFloor: boolean };

/**
 * One `"<number> <unit>"` token. Anything that is not a plain
 * number-then-letters token (fractions, "2× jar", free text) is passed
 * through verbatim — guessing at those would be worse than leaving them.
 */
function purchasableToken(token: string): PurchasableToken {
  const trimmed = token.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]*)$/);
  if (!match) return { text: trimmed, belowFloor: false };

  const value = Number.parseFloat(match[1]!);
  if (!Number.isFinite(value) || value <= 0) return { text: trimmed, belowFloor: false };

  const unit = (match[2] ?? "").trim();
  const rule = UNIT_RULES[unit.toLowerCase()] ?? COUNT_RULE;
  if (rule.floor > 0 && value < rule.floor) return { text: trimmed, belowFloor: true };

  const step = rule.steps.find(([appliesBelow]) => value < appliesBelow)?.[1] ?? rule.fallbackStep;
  const rounded = formatQuantityNumber(roundUpToStep(value, step));
  return { text: unit ? `${rounded} ${unit}` : rounded, belowFloor: false };
}

/**
 * Turn a merged shopping quantity label ("266.66 g", "600 g + 2 breast",
 * "2.5 g") into something a shopper can act on.
 *
 * Mixed labels keep EVERY token. Sub-floor components are rendered verbatim
 * alongside the rounded ones rather than dropped.
 *
 * The earlier behaviour dropped them, reasoning that in "1 g + 2 tbsp" the gram
 * trace is noise beside the spoon measure. That is true of the tidiness, and
 * false of the contract: this helper's one hard guarantee is that what it prints
 * is never LESS than what the plan requires. Dropping a component breaks that
 * guarantee for the sake of a cleaner string, and a shopping row that silently
 * omits a requirement is the worst failure this feature has. The magnitude is
 * small by construction (anything sub-floor is under 5 g / 0.25 tsp), which is
 * exactly why keeping it costs nothing.
 *
 * Only when EVERY token is sub-floor does the quantity collapse to the
 * qualitative marker — and then `exact` carries the real figure to the caption,
 * so the number is relocated, never lost.
 */
export function toPurchasableShoppingQuantity(
  label: string | null | undefined,
): PurchasableShoppingQuantity {
  const raw = (label ?? "").trim();
  if (!raw) return { kind: "none" };

  const tokens = raw.split(" + ").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { kind: "none" };

  const mapped = tokens.map(purchasableToken);
  if (mapped.every((t) => t.belowFloor)) {
    // Every component is under its purchasable step — print the recipe idiom and
    // hand the untouched requirement to the caption so the figure is relocated,
    // not lost.
    return { kind: "qualitative", text: SHOPPING_QUALITATIVE_LABEL, exact: raw };
  }
  // At least one component is buyable: keep them ALL. Sub-floor tokens carry
  // their verbatim text (`purchasableToken` returns the trimmed original when it
  // is below the floor), so the printed total still covers the requirement.
  return { kind: "amount", text: mapped.map((t) => t.text).join(" + ") };
}

/**
 * One-line row label (accessibility labels, share/export text, long-press
 * sheets) built from the purchasable quantity — so what a screen reader
 * announces matches what the row prints.
 */
export function composeShoppingRowLabel(
  quantity: PurchasableShoppingQuantity,
  name: string,
): string {
  const trimmed = name.trim();
  if (quantity.kind === "none") return trimmed;
  if (!trimmed) return quantity.text;
  // Numeric-leading quantities read naturally in front ("700 g spinach");
  // everything else trails the name ("oregano · to taste", "eggs · 2× box").
  const leadsWithNumber = /^[\d/]/.test(quantity.text) || /^\d+×/.test(quantity.text);
  return leadsWithNumber && quantity.kind === "amount"
    ? `${quantity.text} ${trimmed}`
    : `${trimmed} · ${quantity.text}`;
}

/* ------------------------------------------------------------------ *
 * 2. Row provenance
 * ------------------------------------------------------------------ */

/**
 * Recipe provenance caption for a shopping row — ALWAYS present when the row
 * came from at least one recipe.
 *
 * `formatShoppingRecipeCountCaption` (ENG-1669) suppressed the caption below
 * two recipes, which made an absent caption read as missing data rather than
 * as "one recipe". A uniformly-annotated column is legible; a
 * conditionally-annotated one is not.
 */
export function formatShoppingProvenanceCaption(recipeCount: number): string | null {
  if (!Number.isFinite(recipeCount) || recipeCount < 1) return null;
  return recipeCount === 1 ? "1 recipe" : `${recipeCount} recipes`;
}

/**
 * The full row caption: recipe provenance, plus the exact requirement when —
 * and only when — the printed quantity collapsed to the qualitative marker.
 *
 * "to taste" is the right call for dried oregano and the wrong call for saffron
 * or yeast, where the shopper genuinely needs the figure to judge whether the
 * jar in the cupboard covers it. Rather than put "1 g" back in the bold amount
 * slot (where it was not buyable and read as nonsense), the number moves to the
 * caption line that already exists, is already rendered on both platforms, and
 * is visible without hover — so nothing is hidden behind a tooltip a touch user
 * can never reach.
 */
export function shoppingRowCaption(input: {
  recipeCount: number;
  quantity: PurchasableShoppingQuantity;
}): string | null {
  const provenance = formatShoppingProvenanceCaption(input.recipeCount);
  if (input.quantity.kind !== "qualitative") return provenance;
  const exact = `${input.quantity.exact} in your plan`;
  return provenance ? `${provenance} · ${exact}` : exact;
}

/* ------------------------------------------------------------------ *
 * 3. Screen chrome meta
 * ------------------------------------------------------------------ */

/** Noon-anchored local Date from a `YYYY-MM-DD` key (DST-safe, never UTC). */
function localDateFromKey(key: string | null | undefined): Date | null {
  if (!key || key.length < 10) return null;
  const parsed = new Date(`${key.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The plan week a shopping list was generated from, as a human range —
 * "24–30 July", or "28 July – 3 August" across a month boundary. Falls back
 * to "This week" when the list has no recorded plan start.
 */
export function formatShoppingWeekRange(planStartDate: string | null | undefined): string {
  const start = localDateFromKey(planStartDate);
  if (!start) return "This week";

  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 6);

  const startDay = start.toLocaleDateString(undefined, { day: "numeric" });
  const endDay = end.toLocaleDateString(undefined, { day: "numeric" });
  const startMonth = start.toLocaleDateString(undefined, { month: "long" });
  const endMonth = end.toLocaleDateString(undefined, { month: "long" });

  return startMonth === endMonth
    ? `${startDay}–${endDay} ${endMonth}`
    : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

/** The same range in the canonical eyebrow's ink caps ("24–30 JULY"). */
export function formatShoppingWeekEyebrow(planStartDate: string | null | undefined): string {
  return formatShoppingWeekRange(planStartDate).toUpperCase();
}

/**
 * Header progress line — "7 of 24 checked", the one number a shopper wants
 * mid-aisle. Returns null for an empty list (the empty state speaks instead).
 */
export function formatShoppingProgressSubtitle(input: {
  checkedCount: number;
  totalCount: number;
  outOfSync?: boolean;
}): string | null {
  if (!Number.isFinite(input.totalCount) || input.totalCount <= 0) return null;
  const stale = input.outOfSync ? " · plan changed since" : "";
  return `${input.checkedCount} of ${input.totalCount} checked${stale}`;
}
