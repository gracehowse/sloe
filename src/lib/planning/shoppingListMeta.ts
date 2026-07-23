/** Local persistence keys for shopping-list plan metadata (ENG-1135 mobile parity). */
export const SHOPPING_LIST_PLAN_START_STORAGE_KEY = "shoppingListPlanStartDate";
export const SHOPPING_LIST_FINGERPRINT_STORAGE_KEY = "shoppingListSourceFingerprint";
export const SHOPPING_LIST_OUT_OF_SYNC_STORAGE_KEY = "shoppingListOutOfSync";

export function formatShoppingListSubtitle(input: {
  itemCount: number;
  planStartDate: string | null;
  outOfSync?: boolean;
  /**
   * ENG-1669 — when the tab badge already owns remaining-count, omit the
   * redundant "N items" and keep only the plan-context clause.
   */
  omitItemCount?: boolean;
}): string {
  const stale = input.outOfSync ? " · plan changed since" : "";
  if (input.planStartDate) {
    const d = new Date(input.planStartDate + "T12:00:00");
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const planPart = `from plan of ${label}${stale}`;
    if (input.omitItemCount) return planPart;
    const countPart = `${input.itemCount} item${input.itemCount === 1 ? "" : "s"}`;
    return `${countPart} · ${planPart}`;
  }
  if (input.omitItemCount) {
    return input.outOfSync ? `from this week's plan${stale}` : "from this week's plan";
  }
  const countPart = `${input.itemCount} item${input.itemCount === 1 ? "" : "s"}`;
  return `${countPart} · from this week's plan${input.outOfSync ? stale : ""}`;
}
