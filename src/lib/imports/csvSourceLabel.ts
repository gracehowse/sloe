/**
 * Map a CSV adapter id (as the import route returns it on `source`) to a
 * human display name. Shared so the web + mobile preview cards label the
 * detected source identically. (ENG-1234)
 */
const CSV_SOURCE_LABELS: Record<string, string> = {
  mfp: "MyFitnessPal",
  "lose-it": "Lose It",
  cronometer: "Cronometer",
};

export function csvSourceLabel(source: string | null | undefined): string {
  if (!source) return "your app";
  return CSV_SOURCE_LABELS[source] ?? "your app";
}

/** Title-case a canonical meal slot (breakfast/lunch/dinner/snack). */
export function mealSlotLabel(slot: string): string {
  if (!slot) return "Snack";
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}
