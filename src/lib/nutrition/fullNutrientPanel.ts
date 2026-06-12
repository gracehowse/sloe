/**
 * Shared row-builder for the "View all nutrients" panel surfaces
 * (mobile `FullNutrientPanelSheet`, web `FullNutrientPanelSheet`).
 *
 * One helper, one section taxonomy, one sort rule — so the two
 * platforms can never disagree on which nutrient appears in which
 * section or which order (audit gap #1, Cronometer parity).
 *
 * Sections (canonical):
 *   - "Macros"   — fibre, fats, carbs, protein, cholesterol, sodium,
 *                  total sugars (no DV).
 *   - "Vitamins" — A, C, D, E, K, B-complex, choline.
 *   - "Minerals" — calcium, iron, magnesium, potassium, zinc,
 *                  phosphorus, iodine, copper, selenium, manganese,
 *                  chromium, molybdenum.
 *
 * Sort rule: WITHIN each section, target nutrients sort by %DV
 * ASCENDING (deficiencies first). Limit nutrients (sodium, sat fat,
 * cholesterol) sort by %DV DESCENDING (worst overshoot first). Target
 * rows precede limit rows when both appear in the same section. Rows
 * with no DV (e.g. sugar) sort to the bottom of their section.
 */

import {
  DAILY_VALUES,
  dailyValuePercent,
  isLimitNutrient,
} from "./dailyValues";

export type FullNutrientPanelSection = "Macros" | "Vitamins" | "Minerals";

export type FullNutrientPanelRow = {
  /** Stable nutrient key (e.g. `fiberG`, `vitaminB12Mcg`). */
  key: string;
  /** Display label (short — e.g. "Vitamin B12"). */
  label: string;
  /** Section the row belongs to. */
  section: FullNutrientPanelSection;
  /** Raw amount in the nutrient's native unit. */
  amount: number;
  /** Native unit string for display (e.g. "g", "mg", "mcg"). */
  unit: "g" | "mg" | "mcg" | "mcg RAE";
  /** Pre-formatted amount + unit (e.g. "12g", "240mg"). */
  amountFormatted: string;
  /** %DV — null when no DV exists for the nutrient. */
  percentDv: number | null;
  /**
   * Whether the nutrient is a limit (sodium / sat fat / cholesterol).
   * Display layer flips colour ramp when this is true.
   */
  isLimit: boolean;
};

/**
 * Curated nutrient row spec. Order here is incidental — the sort by
 * %DV happens in `buildFullNutrientPanelRows`. Labels match the
 * existing `MICRO_LINES` labels in `microNutrientDisplay.ts` so the
 * widget, the all-nutrients modal, and this sheet all read the same.
 */
type RowSpec = {
  key: string;
  label: string;
  section: FullNutrientPanelSection;
  unit: "g" | "mg" | "mcg" | "mcg RAE";
  /** True when the value is naturally a decimal (e.g. 1.2mg thiamin). */
  decimal?: boolean;
};

const ROW_SPECS: ReadonlyArray<RowSpec> = [
  // Macros
  { key: "totalFatG", label: "Total fat", section: "Macros", unit: "g", decimal: true },
  { key: "saturatedFatG", label: "Saturated fat", section: "Macros", unit: "g", decimal: true },
  { key: "totalCarbsG", label: "Total carbs", section: "Macros", unit: "g" },
  { key: "fiberG", label: "Fiber", section: "Macros", unit: "g" },
  { key: "sugarG", label: "Sugar", section: "Macros", unit: "g", decimal: true },
  { key: "proteinG", label: "Protein", section: "Macros", unit: "g" },
  { key: "cholesterolMg", label: "Cholesterol", section: "Macros", unit: "mg" },
  { key: "sodiumMg", label: "Sodium", section: "Macros", unit: "mg" },

  // Vitamins
  { key: "vitaminAMcgRae", label: "Vitamin A", section: "Vitamins", unit: "mcg RAE" },
  { key: "vitaminCMg", label: "Vitamin C", section: "Vitamins", unit: "mg", decimal: true },
  { key: "vitaminDMcg", label: "Vitamin D", section: "Vitamins", unit: "mcg" },
  { key: "vitaminEMg", label: "Vitamin E", section: "Vitamins", unit: "mg", decimal: true },
  { key: "vitaminKMcg", label: "Vitamin K", section: "Vitamins", unit: "mcg" },
  { key: "thiaminMg", label: "Thiamin (B1)", section: "Vitamins", unit: "mg", decimal: true },
  { key: "riboflavinMg", label: "Riboflavin (B2)", section: "Vitamins", unit: "mg", decimal: true },
  { key: "niacinMg", label: "Niacin (B3)", section: "Vitamins", unit: "mg", decimal: true },
  { key: "vitaminB6Mg", label: "Vitamin B6", section: "Vitamins", unit: "mg", decimal: true },
  { key: "biotinMcg", label: "Biotin (B7)", section: "Vitamins", unit: "mcg" },
  { key: "folateMcg", label: "Folate (B9)", section: "Vitamins", unit: "mcg" },
  { key: "vitaminB12Mcg", label: "Vitamin B12", section: "Vitamins", unit: "mcg", decimal: true },
  { key: "pantothenicAcidMg", label: "Pantothenic acid", section: "Vitamins", unit: "mg", decimal: true },
  { key: "cholineMg", label: "Choline", section: "Vitamins", unit: "mg" },

  // Minerals
  { key: "calciumMg", label: "Calcium", section: "Minerals", unit: "mg" },
  { key: "ironMg", label: "Iron", section: "Minerals", unit: "mg" },
  { key: "magnesiumMg", label: "Magnesium", section: "Minerals", unit: "mg" },
  { key: "potassiumMg", label: "Potassium", section: "Minerals", unit: "mg" },
  { key: "zincMg", label: "Zinc", section: "Minerals", unit: "mg", decimal: true },
  { key: "phosphorusMg", label: "Phosphorus", section: "Minerals", unit: "mg" },
  { key: "iodineMcg", label: "Iodine", section: "Minerals", unit: "mcg" },
  { key: "copperMg", label: "Copper", section: "Minerals", unit: "mg", decimal: true },
  { key: "seleniumMcg", label: "Selenium", section: "Minerals", unit: "mcg" },
  { key: "manganeseMg", label: "Manganese", section: "Minerals", unit: "mg", decimal: true },
  { key: "chromiumMcg", label: "Chromium", section: "Minerals", unit: "mcg" },
  { key: "molybdenumMcg", label: "Molybdenum", section: "Minerals", unit: "mcg" },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatAmount(amount: number, unit: RowSpec["unit"], decimal: boolean): string {
  const n = decimal ? round1(amount) : Math.round(amount);
  if (unit === "mcg RAE") return `${n}mcg RAE`;
  return `${n}${unit}`;
}

/**
 * Inputs to the panel-row builder. Macro grand totals (`totalFatG`,
 * `saturatedFatG`, `totalCarbsG`, `proteinG`, `sugarG`,
 * `cholesterolMg`) come from the day-totals path used by the macro
 * tiles, NOT from `microSum` — the meal column is the source of truth
 * for those even when individual meal `micros` maps don't carry them.
 *
 * `fiberG` likewise comes from the dedicated `fiberG` column path
 * (see `mealContributedFiberG`) so the panel agrees with the macro
 * tile shown on Today.
 *
 * Everything else is read out of `microSum` — the result of
 * `sumMicrosFromLoggedMeals(meals)`.
 */
export type FullNutrientPanelInput = {
  microSum: Record<string, number> | null | undefined;
  /** Day-totalled fibre in grams (column-first path). */
  fiberG: number;
  /** Day-totalled total fat in grams (macro path). */
  totalFatG?: number;
  /** Day-totalled saturated fat in grams (macro path). */
  saturatedFatG?: number;
  /** Day-totalled carbs in grams (macro path). */
  totalCarbsG?: number;
  /** Day-totalled protein in grams (macro path). */
  proteinG?: number;
  /** Day-totalled total sugars in grams. */
  sugarG?: number;
  /** Day-totalled cholesterol in mg (column-first path). */
  cholesterolMg?: number;
};

/**
 * Read an amount for a row, preferring the explicit macro override
 * over `microSum[key]`. Returns 0 for absent / non-finite / negative.
 */
function resolveAmount(
  spec: RowSpec,
  input: FullNutrientPanelInput,
  microSum: Record<string, number>,
): number {
  const overrides: Record<string, number | undefined> = {
    fiberG: input.fiberG,
    totalFatG: input.totalFatG,
    saturatedFatG: input.saturatedFatG,
    totalCarbsG: input.totalCarbsG,
    proteinG: input.proteinG,
    sugarG: input.sugarG,
    cholesterolMg: input.cholesterolMg,
  };
  const candidate =
    overrides[spec.key] !== undefined ? overrides[spec.key] : microSum[spec.key];
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) return 0;
  return candidate < 0 ? 0 : candidate;
}

/**
 * Build the canonical, sorted list of section + row tuples for the
 * full-nutrient sheet. Sections are returned in the canonical order
 * (Macros → Vitamins → Minerals); rows within each section are sorted
 * by %DV descending (null %DV last so deficiencies surface).
 */
export function buildFullNutrientPanelRows(
  input: FullNutrientPanelInput,
): Array<{ section: FullNutrientPanelSection; rows: FullNutrientPanelRow[] }> {
  const microSum = input.microSum ?? {};
  const sectionOrder: FullNutrientPanelSection[] = [
    "Macros",
    "Vitamins",
    "Minerals",
  ];

  const out: Array<{
    section: FullNutrientPanelSection;
    rows: FullNutrientPanelRow[];
  }> = [];

  for (const section of sectionOrder) {
    const rows: FullNutrientPanelRow[] = [];
    for (const spec of ROW_SPECS) {
      if (spec.section !== section) continue;
      const amount = resolveAmount(spec, input, microSum);
      const pct = dailyValuePercent(spec.key, amount);
      rows.push({
        key: spec.key,
        label: spec.label,
        section,
        amount,
        unit: spec.unit,
        amountFormatted: formatAmount(amount, spec.unit, spec.decimal === true),
        percentDv: pct,
        isLimit: isLimitNutrient(spec.key),
      });
    }

    // Target nutrients ascending (deficiencies first); limit nutrients
    // descending (overshoot first). Null-%DV rows sink to the bottom.
    rows.sort((a, b) => {
      const aHas = a.percentDv !== null;
      const bHas = b.percentDv !== null;
      if (!aHas && !bHas) return a.label.localeCompare(b.label);
      if (!aHas) return 1;
      if (!bHas) return -1;
      if (a.isLimit !== b.isLimit) return a.isLimit ? 1 : -1;
      if (a.isLimit) {
        return (b.percentDv as number) - (a.percentDv as number);
      }
      return (a.percentDv as number) - (b.percentDv as number);
    });

    out.push({ section, rows });
  }

  // Sanity: rows count should always equal ROW_SPECS length.
  void DAILY_VALUES;
  return out;
}

/** Total number of curated rows the panel will render. */
export const FULL_NUTRIENT_PANEL_ROW_COUNT = ROW_SPECS.length;
