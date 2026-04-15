/** Short labels for feed cards and detail (e.g. "15 min", "1h 30m"). */
export function formatRecipeMinutes(totalMinutes: number | null | undefined): string | undefined {
  if (totalMinutes == null || !Number.isFinite(totalMinutes) || totalMinutes <= 0) return undefined;
  const m = Math.round(totalMinutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}
