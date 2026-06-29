/**
 * ENG-1259 (B21) — "The detail" rows below the shareable Weekly Recap card.
 * Shared web↔mobile derivation; only surfaces rows backed by real data.
 */

export type WeeklyRecapDetailRowId = "weight" | "streak" | "most-cooked" | "protein";

export interface WeeklyRecapDetailRow {
  id: WeeklyRecapDetailRowId;
  title: string;
  subtitle: string;
}

export interface WeeklyRecapDetailInput {
  weightStartKg: number | null;
  weightEndKg: number | null;
  weighInsInWindow: number;
  streakDays: number;
  meals: ReadonlyArray<{ recipeTitle?: string | null; name?: string | null }>;
  avgProteinG: number;
  daysLogged: number;
}

export function deriveMostCookedMeal(
  meals: ReadonlyArray<{ recipeTitle?: string | null; name?: string | null }>,
): { title: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const meal of meals) {
    const raw = (meal.recipeTitle ?? meal.name ?? "").trim();
    if (!raw) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  let best: { title: string; count: number } | null = null;
  for (const [title, count] of counts) {
    if (!best || count > best.count) best = { title, count };
  }
  return best && best.count > 0 ? best : null;
}

export function formatWeightDeltaSubtitle(
  startKg: number,
  endKg: number,
): string {
  const delta = endKg - startKg;
  const abs = Math.abs(delta);
  const formatted = abs < 0.05 ? "0.0" : abs.toFixed(1);
  const sign = delta < -0.05 ? "−" : delta > 0.05 ? "+" : "";
  return `${sign}${formatted} kg this week`;
}

export function deriveWeeklyRecapDetailRows(
  input: WeeklyRecapDetailInput,
): WeeklyRecapDetailRow[] {
  const rows: WeeklyRecapDetailRow[] = [];

  if (
    input.weighInsInWindow >= 2 &&
    input.weightStartKg != null &&
    input.weightEndKg != null &&
    Number.isFinite(input.weightStartKg) &&
    Number.isFinite(input.weightEndKg)
  ) {
    rows.push({
      id: "weight",
      title: "Weight",
      subtitle: formatWeightDeltaSubtitle(input.weightStartKg, input.weightEndKg),
    });
  }

  if (input.streakDays > 0) {
    rows.push({
      id: "streak",
      title: "Best streak",
      subtitle:
        input.streakDays === 1
          ? "1 day and counting"
          : `${input.streakDays} days and counting`,
    });
  }

  const mostCooked = deriveMostCookedMeal(input.meals);
  if (mostCooked && mostCooked.count >= 2) {
    rows.push({
      id: "most-cooked",
      title: "Most-cooked",
      subtitle: `${mostCooked.title} ×${mostCooked.count}`,
    });
  }

  if (input.daysLogged > 0 && input.avgProteinG > 0) {
    rows.push({
      id: "protein",
      title: "Protein average",
      subtitle: `${input.avgProteinG} g / day`,
    });
  }

  return rows;
}
