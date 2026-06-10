/** Shared gram-formatter for planned-meal macros. Avoids showing `0g`
 *  when grams are small but calories are meaningful (renders `<1`), and
 *  keeps one decimal for sub-gram-but-not-tiny values. Used by both the
 *  single-line and structured formatters so the two cannot drift. */
function formatPlannedMealGram(g: number, meaningfulCal: boolean): string {
  const v = Math.max(0, Number(g) || 0);
  const r = Math.round(v);
  if (meaningfulCal && r === 0 && v > 0.001) {
    if (v < 0.5) return "<1";
    return String(Math.round(v * 10) / 10);
  }
  if (r === 0 && v > 0.05 && v < 0.5) return "<1";
  if (r === 0 && v >= 0.5) return String(Math.round(v * 10) / 10);
  return String(r);
}

/**
 * One-line kcal + P/C/F for planner rows and Today "Planned" card.
 * Avoids showing `0g` everywhere when grams are small but calories are meaningful.
 */
export function formatPlannedMealKcalMacrosLine(
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): string {
  const calR = Math.round(Number(calories) || 0);
  const meaningfulCal = calR >= 30;
  const fmtG = (g: number) => formatPlannedMealGram(g, meaningfulCal);
  return `${calR} kcal · P ${fmtG(protein)}g · C ${fmtG(carbs)}g · F ${fmtG(fat)}g`;
}

/**
 * Structured kcal + per-macro gram strings for the Sloe `TD3` Planned card,
 * which colours each macro. Uses the SAME rounding rules as
 * `formatPlannedMealKcalMacrosLine` (via `formatPlannedMealGram`) so a
 * coloured row and a plain-string row can never disagree on a value.
 * `kcal` is the rounded integer (caller appends "kcal"); each gram string is
 * ready to render with a trailing "g" (e.g. "27", "<1").
 */
export function formatPlannedMealMacroParts(
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): { kcal: number; protein: string; carbs: string; fat: string } {
  const calR = Math.round(Number(calories) || 0);
  const meaningfulCal = calR >= 30;
  return {
    kcal: calR,
    protein: formatPlannedMealGram(protein, meaningfulCal),
    carbs: formatPlannedMealGram(carbs, meaningfulCal),
    fat: formatPlannedMealGram(fat, meaningfulCal),
  };
}
