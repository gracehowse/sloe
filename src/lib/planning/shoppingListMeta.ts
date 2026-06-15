/** Local persistence keys for shopping-list plan metadata (ENG-1135 mobile parity). */
export const SHOPPING_LIST_PLAN_START_STORAGE_KEY = "shoppingListPlanStartDate";
export const SHOPPING_LIST_FINGERPRINT_STORAGE_KEY = "shoppingListSourceFingerprint";
export const SHOPPING_LIST_OUT_OF_SYNC_STORAGE_KEY = "shoppingListOutOfSync";

export function formatShoppingListSubtitle(input: {
  itemCount: number;
  planStartDate: string | null;
  outOfSync?: boolean;
}): string {
  const countPart = `${input.itemCount} item${input.itemCount === 1 ? "" : "s"}`;
  if (input.planStartDate) {
    const d = new Date(input.planStartDate + "T12:00:00");
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const stale = input.outOfSync ? " · plan changed since" : "";
    return `${countPart} · from plan of ${label}${stale}`;
  }
  return `${countPart} · from this week's plan`;
}
