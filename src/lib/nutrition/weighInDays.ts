/**
 * ENG-758 — count distinct weigh-in days within the last `windowDays`
 * (inclusive of `todayDayKey`) from the profile's `weight_kg_by_day` map
 * (`YYYY-MM-DD` → kg). Powers the Today "Adaptive TDEE learning · N of 7
 * days" pill with a REAL count instead of the old `adaptiveTdeeConfidence`
 * tier proxy (high→6, medium→4, low→2). Pure + shared web/mobile so the two
 * surfaces can't drift.
 *
 * Self-contained (no cross-file imports) so it's safe under both the web and
 * mobile tsconfigs. `todayDayKey` is the caller's local today key
 * (`todayKey()` web / `dateKeyFromDate(new Date())` mobile), passed in so the
 * helper is deterministic + unit-testable.
 */

/** Shift a `YYYY-MM-DD` key by `delta` days (local-time), same convention as
 *  `trackerDate.shiftDateKey` / `dateKeyFromDate`. */
function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function countWeighInDaysInWindow(
  weightKgByDay: Record<string, number> | null | undefined,
  todayDayKey: string,
  windowDays = 7,
): number {
  if (!weightKgByDay || windowDays <= 0) return 0;
  let count = 0;
  for (let i = 0; i < windowDays; i++) {
    const key = i === 0 ? todayDayKey : shiftDayKey(todayDayKey, -i);
    const kg = weightKgByDay[key];
    if (typeof kg === "number" && Number.isFinite(kg) && kg > 0) count += 1;
  }
  return count;
}
