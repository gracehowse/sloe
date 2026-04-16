/**
 * Shared micronutrient labels + formatting (surplus-only density display).
 * Used by web tracker, mobile tracker, meal detail, and Health import mapping.
 */

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Prefer `fiberG` column when set; otherwise `micros.fiberG` (e.g. Health / dense logs). */
export function mealContributedFiberG(m: {
  fiberG?: number | null;
  micros?: Record<string, number> | null | undefined;
}): number {
  const col = typeof m.fiberG === "number" && Number.isFinite(m.fiberG) ? Math.max(0, m.fiberG) : 0;
  if (col > 0) return col;
  const u = m.micros?.fiberG;
  const fromMicro = typeof u === "number" && Number.isFinite(u) ? Math.max(0, u) : 0;
  return fromMicro;
}

export function sumDayFiberFromMeals(
  meals: ReadonlyArray<{ fiberG?: number | null; micros?: Record<string, number> | null | undefined }>,
): number {
  let s = 0;
  for (const m of meals) s += mealContributedFiberG(m);
  return Math.round(s);
}

export type MealNutritionDisplayInput = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number | null;
  micros?: Record<string, number> | null;
};

type MicroLine = { label: string; key: string; format: (n: number) => string };

const MICRO_LINES: MicroLine[] = [
  { key: "sugarG", label: "Sugar", format: (n) => `${round1(n)}g` },
  { key: "sodiumMg", label: "Sodium", format: (n) => `${Math.round(n)}mg` },
  { key: "saturatedFatG", label: "Sat. fat", format: (n) => `${round1(n)}g` },
  { key: "monoFatG", label: "Mono fat", format: (n) => `${round1(n)}g` },
  { key: "polyFatG", label: "Poly fat", format: (n) => `${round1(n)}g` },
  { key: "transFatG", label: "Trans fat", format: (n) => `${round1(n)}g` },
  { key: "cholesterolMg", label: "Cholesterol", format: (n) => `${Math.round(n)}mg` },
  { key: "caffeineMg", label: "Caffeine", format: (n) => `${Math.round(n)}mg` },
  { key: "calciumMg", label: "Calcium", format: (n) => `${Math.round(n)}mg` },
  { key: "ironMg", label: "Iron", format: (n) => `${Math.round(n)}mg` },
  { key: "magnesiumMg", label: "Magnesium", format: (n) => `${Math.round(n)}mg` },
  { key: "phosphorusMg", label: "Phosphorus", format: (n) => `${Math.round(n)}mg` },
  { key: "potassiumMg", label: "Potassium", format: (n) => `${Math.round(n)}mg` },
  { key: "zincMg", label: "Zinc", format: (n) => `${Math.round(n)}mg` },
  { key: "copperMg", label: "Copper", format: (n) => `${Math.round(n)}mg` },
  { key: "seleniumMcg", label: "Selenium", format: (n) => `${Math.round(n)}mcg` },
  { key: "manganeseMg", label: "Manganese", format: (n) => `${Math.round(n)}mg` },
  { key: "molybdenumMcg", label: "Molybdenum", format: (n) => `${Math.round(n)}mcg` },
  { key: "iodineMcg", label: "Iodine", format: (n) => `${Math.round(n)}mcg` },
  { key: "chromiumMcg", label: "Chromium", format: (n) => `${Math.round(n)}mcg` },
  { key: "chlorideMg", label: "Chloride", format: (n) => `${Math.round(n)}mg` },
  { key: "thiaminMg", label: "Thiamin (B1)", format: (n) => `${round1(n)}mg` },
  { key: "riboflavinMg", label: "Riboflavin (B2)", format: (n) => `${round1(n)}mg` },
  { key: "niacinMg", label: "Niacin (B3)", format: (n) => `${round1(n)}mg` },
  { key: "pantothenicAcidMg", label: "Pantothenic acid", format: (n) => `${round1(n)}mg` },
  { key: "vitaminB6Mg", label: "Vitamin B6", format: (n) => `${round1(n)}mg` },
  { key: "biotinMcg", label: "Biotin", format: (n) => `${Math.round(n)}mcg` },
  { key: "folateMcg", label: "Folate", format: (n) => `${Math.round(n)}mcg` },
  { key: "vitaminB12Mcg", label: "Vitamin B12", format: (n) => `${Math.round(n)}mcg` },
  { key: "vitaminCMg", label: "Vitamin C", format: (n) => `${round1(n)}mg` },
  { key: "vitaminDMcg", label: "Vitamin D", format: (n) => `${Math.round(n)}mcg` },
  { key: "vitaminEMg", label: "Vitamin E", format: (n) => `${round1(n)}mg` },
  { key: "vitaminKMcg", label: "Vitamin K", format: (n) => `${Math.round(n)}mcg` },
  { key: "vitaminAMcgRae", label: "Vitamin A", format: (n) => `${Math.round(n)}mcg RAE` },
];

export type MicroNutrientDisplayRow = { key: string; label: string; value: string };

/** Turn a raw `nutrition_micros` key into a short human label when we do not have a curated row. */
export function humanizeNutrientKey(key: string): string {
  if (!key) return key;
  const spaced = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Ordered micro rows for list UIs (same ordering as `formatMealNutritionMultiline`). */
export function listMicroNutrientsForDisplay(micros: Record<string, number> | null | undefined): MicroNutrientDisplayRow[] {
  const ms = micros ?? {};
  const rows: MicroNutrientDisplayRow[] = [];
  for (const row of MICRO_LINES) {
    const v = ms[row.key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      rows.push({ key: row.key, label: row.label, value: row.format(v) });
    }
  }
  for (const [k, v] of Object.entries(ms)) {
    if (MICRO_LINES.some((r) => r.key === k)) continue;
    if (typeof v === "number" && Number.isFinite(v) && v !== 0) {
      rows.push({ key: k, label: humanizeNutrientKey(k), value: `${round1(v)}` });
    }
  }
  return rows;
}

/**
 * Full micronutrient table for a single entry: every curated line in `MICRO_LINES` (with "—" when zero),
 * then any extra keys present in `micros` that are not in the curated list.
 */
export function listMicroNutrientsCompleteDisplay(micros: Record<string, number> | null | undefined): MicroNutrientDisplayRow[] {
  const ms = micros ?? {};
  const rows: MicroNutrientDisplayRow[] = [];
  for (const row of MICRO_LINES) {
    const v = ms[row.key];
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    rows.push({
      key: row.key,
      label: row.label,
      value: n > 0 ? row.format(n) : "—",
    });
  }
  const curated = new Set(MICRO_LINES.map((r) => r.key));
  for (const [k, v] of Object.entries(ms)) {
    if (curated.has(k)) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    rows.push({
      key: k,
      label: humanizeNutrientKey(k),
      value: v !== 0 ? `${round1(v)}` : "—",
    });
  }
  return rows;
}

/** Sum `nutrition_micros` maps across all meals for the day. */
export function sumMicrosFromLoggedMeals(
  meals: ReadonlyArray<{ micros?: Record<string, number> | null | undefined }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of meals) {
    const u = m.micros;
    if (!u || typeof u !== "object") continue;
    for (const [k, v] of Object.entries(u)) {
      if (typeof v === "number" && Number.isFinite(v) && v !== 0) {
        out[k] = (out[k] ?? 0) + v;
      }
    }
  }
  return out;
}

/**
 * Day-level detail rows: fiber from meal columns first, then summed micros (excluding duplicate fiberG).
 */
export function buildDayNutrientDetailRows(
  fiberTotalG: number,
  microSum: Record<string, number>,
): MicroNutrientDisplayRow[] {
  const rest = { ...microSum };
  delete rest.fiberG;
  const fromMicros = listMicroNutrientsForDisplay(Object.keys(rest).length ? rest : undefined);
  const rows: MicroNutrientDisplayRow[] = [];
  if (fiberTotalG > 0) {
    rows.push({ key: "__fiber_day", label: "Fiber", value: `${round1(fiberTotalG)}g` });
  }
  rows.push(...fromMicros);
  return rows;
}

/** Multi-line detail suitable for alerts / modals. */
export function formatMealNutritionMultiline(m: MealNutritionDisplayInput): string {
  const head = [
    `${Math.round(m.calories)} kcal`,
    `P ${Math.round(m.protein)}g`,
    `C ${Math.round(m.carbs)}g`,
    `F ${Math.round(m.fat)}g`,
  ];
  const fiberDisp = mealContributedFiberG(m);
  if (fiberDisp > 0) head.push(`Fiber ${round1(fiberDisp)}g`);

  const microRows = listMicroNutrientsForDisplay(m.micros ?? undefined);
  const extras = microRows.map((r) => `${r.label}: ${r.value}`);

  if (extras.length === 0) return head.join(" · ");
  return `${head.join(" · ")}\n\n${extras.join("\n")}`;
}
