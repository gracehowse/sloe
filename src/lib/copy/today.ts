/** Canonical copy for the Today / tracker / calorie-balance surfaces across
 *  web, mobile, and the marketing landing page.
 *
 *  Purpose: **one source** for the words we use around the daily calorie
 *  ring and net balance. If you change a string here, the parity test in
 *  `tests/unit/todayCopyParity.test.ts` will catch surfaces that drift.
 *
 *  Not for UI composition — just the strings. UI components own layout.
 *
 *  Used by:
 *    - Web:    `NutritionTracker`, `BurnDetailPanel`, `CalorieDeficitInsight`
 *    - Mobile: `TodayDeficitInsight`, `TodayActivityBonusCard`
 *    - Landing `app/(landing)/LandingPage.tsx`
 */

/** Overline labels above the big number inside the daily calorie ring.
 *  The ring has three states:
 *    - `consumed` display mode   → label is `LOGGED`, number is kcal logged
 *    - `remaining`, under target → label is `REMAINING`, number is kcal left
 *    - `remaining`, over target  → label is `OVER`, number is kcal over target
 *  Rendered uppercase by the ring components on both platforms. */
export const RING_LABELS = {
  logged: "LOGGED",
  remaining: "REMAINING",
  over: "OVER",
} as const;

/** Back-compat alias — prefer `RING_LABELS.remaining`. */
export const TODAY_RING_OVERLINE = RING_LABELS.remaining;

/** Suffix rendered below the ring number, e.g. "of 1,800 kcal". Never
 *  show the number without the `kcal` unit — the prototype used to drop
 *  the unit in some mocks and that led to ambiguity ("380 of 1,800" —
 *  of what?). */
export function todayRingSuffix(targetKcal: number): string {
  return `of ${targetKcal.toLocaleString()} kcal`;
}

/** The four stat tiles that sit beside the calorie ring on Today.
 *  Order matters — matches the visual 2x2 reading order used on web +
 *  landing (Logged / Target / Burned / Net). */
export const TODAY_STAT_LABELS = {
  logged: "Logged",
  target: "Target",
  burned: "Burned",
  net: "Net",
} as const;

/** Detail line for the `Net` stat — describes which side of maintenance
 *  the user is on in plain deficit/surplus terms. "Deficit" is the
 *  canonical word across product (matches mobile `Net deficit / Net
 *  surplus` and web `Budget & deficit`). Historical variants "below
 *  maint.", "below TDEE", and "under budget" are retired. */
export const NET_DEFICIT_LABEL = "deficit";
export const NET_SURPLUS_LABEL = "surplus";
export const NET_MAINTENANCE_LABEL = "maintenance";

/** Resolve the net detail from kcal delta (net = logged − target).
 *  - Negative delta  → deficit (user ate less than target)
 *  - Positive delta  → surplus
 *  - Exactly zero    → maintenance  */
export function netDetailFromKcal(netKcal: number): string {
  if (netKcal < 0) return NET_DEFICIT_LABEL;
  if (netKcal > 0) return NET_SURPLUS_LABEL;
  return NET_MAINTENANCE_LABEL;
}

/** Section header convention for today's meals. We use **per-slot
 *  headers** (Breakfast / Lunch / Dinner / Snack) across web, mobile,
 *  and landing — never a single generic "Today's meals" title. Slot
 *  headers keep landing screenshots visually identical to the real
 *  product and help the user parse meals by slot at a glance. */
export const MEAL_SLOT_HEADERS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
} as const;

/** Prose headline for the "today's calorie balance" banner. Used by
 *  web `CalorieDeficitInsight` and mobile `TodayDeficitInsight`. */
export function todayBalanceHeadline(balanceKcal: number): string {
  if (balanceKcal > 0) {
    return `About ${balanceKcal.toLocaleString()} kcal ${NET_DEFICIT_LABEL} so far today`;
  }
  if (balanceKcal < 0) {
    return `About ${Math.abs(balanceKcal).toLocaleString()} kcal ${NET_SURPLUS_LABEL} so far today`;
  }
  return "On your calorie target so far today";
}

/** Phrases that must never ship on any Today surface. Used by
 *  `tests/unit/todayCopyParity.test.ts` as a grep list. If a real
 *  user-facing need brings one of these back, update *both* the test
 *  allowlist and this constant so the drift is a deliberate decision. */
export const FORBIDDEN_TODAY_PHRASES = [
  "below maint",
  "below maintenance",
  "below TDEE",
  "under budget",
  "over budget",
  "Today's meals",
  "Today’s meals",
] as const;
