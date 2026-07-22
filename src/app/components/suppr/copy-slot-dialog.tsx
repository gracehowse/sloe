"use client";

import { toast } from "sonner";
import { CopyMealDialog } from "./copy-meal-dialog";
import { todayKey } from "../../../lib/nutrition/trackerDate.ts";

type CopySlotOutcome = {
  itemCount: number;
  createdIdsByDay: Record<string, string[]>;
};

type Props = {
  /** `{ slot }` while the whole-slot copy dialog is open; `null` when closed. */
  target: { slot: string } | null;
  onClose: () => void;
  /** `YYYY-MM-DD` of the day currently being viewed (the copy source). */
  sourceDayKey: string;
  /** The app's enabled meal-slot labels, for the dialog's slot picker. */
  slots: readonly string[];
  /** Meals grouped by slot on the source day — used only for the slot's count. */
  mealsGrouped: ReadonlyArray<{ name: string; meals: ReadonlyArray<unknown> }>;
  copySlotToDateRange: (
    sourceDayKey: string,
    sourceSlot: string,
    targetSlot: string,
    targetDayKeys: string[],
  ) => Promise<CopySlotOutcome>;
  undoCopyToSlot: (createdIdsByDay: Record<string, string[]>) => void;
};

/**
 * CopySlotDialog — ENG-786 rebuild host for the whole-slot "Copy to another
 * day" flow. Extracted out of `NutritionTracker` so that legacy screen stays
 * under its line budget (ENG-621/717) while gaining this feature.
 *
 * Resolves the source slot's current item count, renders the shared
 * `CopyMealDialog` (with its slot picker), and on confirm commits every entry
 * in the slot via `copySlotToDateRange`, then shows a success toast carrying a
 * real Undo action. Distinct from the single-meal copy dialog: this copies the
 * WHOLE slot, not one meal. When the viewed source day is in the past the
 * default target becomes "today" (never a still-past "source + 1"). Mirror of
 * mobile's CopySheet wiring in `apps/mobile/hooks/useCopyDuplicateMeal.ts`.
 */
export function CopySlotDialog({
  target,
  onClose,
  sourceDayKey,
  slots,
  mealsGrouped,
  copySlotToDateRange,
  undoCopyToSlot,
}: Props) {
  if (!target) return null;
  const slot = target.slot;
  const count = mealsGrouped.find((g) => g.name === slot)?.meals.length ?? 0;
  if (count === 0) return null;
  return (
    <CopyMealDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      sourceDayKey={sourceDayKey}
      sourceSlot={slot}
      slots={slots}
      mealLabel={`${count} item${count > 1 ? "s" : ""}`}
      initialTargetDayKey={sourceDayKey < todayKey() ? todayKey() : undefined}
      onConfirm={(targetDayKeys, targetSlot, summary) => {
        void copySlotToDateRange(sourceDayKey, slot, targetSlot, targetDayKeys).then(
          ({ itemCount, createdIdsByDay }) => {
            if (itemCount === 0) {
              toast.info("Nothing to copy");
              return;
            }
            // `summary` already reads "Copied to <day>[ · <slot>]" — splice in
            // the item count rather than stacking a second "Copied" (e.g.
            // "Copied 3 items to Tue 22 Jul · Lunch").
            const tail = summary.replace(/^Copied /, "");
            toast.success(`Copied ${itemCount} item${itemCount > 1 ? "s" : ""} ${tail}`, {
              action: { label: "Undo", onClick: () => undoCopyToSlot(createdIdsByDay) },
            });
          },
        );
      }}
    />
  );
}

export default CopySlotDialog;
