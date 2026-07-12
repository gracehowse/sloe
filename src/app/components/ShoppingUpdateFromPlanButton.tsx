import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { RegenerateShoppingListResult } from "../../lib/planning/regenerateShoppingListFromPlan.ts";

/**
 * ENG-1527 — the web "Update from plan" affordance (mobile parity). Shown when
 * the shopping list is out of sync with the meal plan; re-runs the shared
 * generator NON-destructively via `resyncShoppingListFromPlan` (checked rows +
 * manual/household additions preserved). Disabled + spinning during the async
 * commit; toasts the outcome. The out-of-sync flag clears on success, so the
 * parent stops rendering this button.
 */
export interface ShoppingUpdateFromPlanButtonProps {
  resync: () => Promise<RegenerateShoppingListResult>;
}

function friendlyError(error: string): string {
  if (/no (active plan|recipes)/i.test(error)) {
    return "There's no active plan to build the list from. Generate a plan first.";
  }
  return "Couldn't update your list. Please try again.";
}

export function ShoppingUpdateFromPlanButton({ resync }: ShoppingUpdateFromPlanButtonProps) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await resync();
      if (!res.ok) {
        toast.error(friendlyError(res.error));
        return;
      }
      const parts: string[] = [];
      if (res.addedCount > 0) parts.push(`added ${res.addedCount}`);
      if (res.updatedCount > 0) parts.push(`updated ${res.updatedCount}`);
      if (res.removedCount > 0) parts.push(`removed ${res.removedCount}`);
      const kept =
        res.keptCheckedCount > 0
          ? ` — kept ${res.keptCheckedCount} checked`
          : "";
      toast.success(
        parts.length > 0
          ? `List updated: ${parts.join(", ")}${kept}`
          : "Your list already matched the plan",
      );
    } catch {
      toast.error("Couldn't update your list. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      data-testid="shopping-update-from-plan"
      className="inline-flex items-center gap-1.5 self-start rounded-full border-[1.5px] border-primary-solid bg-transparent px-3 py-1.5 text-[13px] font-bold text-primary-solid transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
    >
      <RefreshCw width={14} height={14} className={busy ? "animate-spin" : ""} aria-hidden />
      {busy ? "Updating…" : "Update from plan"}
    </button>
  );
}

export default ShoppingUpdateFromPlanButton;
