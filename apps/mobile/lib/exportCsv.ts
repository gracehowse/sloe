/**
 * Generate a CSV string from nutrition journal entries.
 * Columns: date, meal, food, calories, protein_g, carbs_g, fat_g, fiber_g, source, time
 */
export function nutritionEntriesToCsv(
  entries: Array<{
    date_key?: string;
    name?: string;
    recipe_title?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber_g?: number | null;
    source?: string;
    time_label?: string;
    created_at?: string;
  }>,
): string {
  const header = "date,meal,food,calories,protein_g,carbs_g,fat_g,fiber_g,source,time";
  const rows = entries.map((e) => {
    const fields = [
      e.date_key ?? "",
      csvEscape(e.name ?? ""),
      csvEscape(e.recipe_title ?? ""),
      Math.round(e.calories ?? 0),
      Math.round(e.protein ?? 0),
      Math.round(e.carbs ?? 0),
      Math.round(e.fat ?? 0),
      e.fiber_g != null ? Math.round(e.fiber_g * 10) / 10 : "",
      csvEscape(e.source ?? "manual"),
      csvEscape(e.time_label ?? ""),
    ];
    return fields.join(",");
  });
  return [header, ...rows].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
