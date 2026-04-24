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

  const fmtG = (g: number) => {
    const v = Math.max(0, Number(g) || 0);
    const r = Math.round(v);
    if (meaningfulCal && r === 0 && v > 0.001) {
      if (v < 0.5) return "<1";
      return String(Math.round(v * 10) / 10);
    }
    if (r === 0 && v > 0.05 && v < 0.5) return "<1";
    if (r === 0 && v >= 0.5) return String(Math.round(v * 10) / 10);
    return String(r);
  };

  return `${calR} kcal · P ${fmtG(protein)}g · C ${fmtG(carbs)}g · F ${fmtG(fat)}g`;
}
