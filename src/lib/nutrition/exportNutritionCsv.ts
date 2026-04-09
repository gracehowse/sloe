import type { LoggedMeal } from "@/types/recipe.ts";

function escapeCsvField(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** One row per logged meal for a calendar day. */
export function buildNutritionCsvForDay(
  dateKey: string,
  meals: LoggedMeal[],
  extraWaterMl: number,
): string {
  const header = [
    "date",
    "time",
    "meal_slot",
    "name",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "water_ml",
  ].join(",");
  const rows = meals.map((m) =>
    [
      dateKey,
      escapeCsvField(m.time),
      escapeCsvField(m.name),
      escapeCsvField(m.recipeTitle),
      String(m.calories),
      String(m.protein),
      String(m.carbs),
      String(m.fat),
      String(m.fiberG ?? ""),
      String(m.waterMl ?? ""),
    ].join(","),
  );
  const extraRow =
    extraWaterMl > 0
      ? [
          `${dateKey},,,Quick water (not in meals),0,0,0,0,0,${extraWaterMl}`,
        ]
      : [];
  return [header, ...rows, ...extraRow].join("\n");
}

export function downloadCsvFile(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
