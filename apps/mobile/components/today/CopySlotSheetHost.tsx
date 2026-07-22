/**
 * Copy-slot sheet + toast host (extracted 2026-07-21, ENG-786 — screen-
 * budget shrink: pulls the whole-slot "Copy to another day" `CopyMealSheet`
 * render block, its `onConfirm`/toast wiring, and its own `useToast()`
 * instance out of `TodayScreen.tsx` (a pinned only-shrink
 * `check:screen-budget` file). Pure extraction, no behaviour change.
 *
 * Parallel to (not merged with) the single-item copy sheet, which stays
 * inline in `TodayScreen.tsx` — different data shape (a whole slot's
 * entries vs one meal id) so it stays a separate instance rather than
 * merging state. No other Today surface uses `useToast`/`<Toast>`, so this
 * remains the ONE instance for the whole screen (mirrors `planner.tsx`'s
 * single host).
 */
import { Spacing } from "@/constants/theme";
import CopyMealSheet from "@/components/CopyMealSheet";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

type CopySlotOutcome = {
  succeeded: string[];
  failed: string[];
  itemCount: number;
  createdIdsByDay: Record<string, string[]>;
};

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  primaryForeground: string;
};

type Props = {
  /** `{ slot }` while the whole-slot copy sheet is open; `null` when closed. */
  copySlotTarget: { slot: string } | null;
  onClose: () => void;
  /** `YYYY-MM-DD` — the day currently being viewed (the copy source). */
  dayKey: string;
  /** Meals grouped by slot on the viewed day — used only for the slot's count. */
  mealGroups: Record<string, readonly unknown[]>;
  slots: readonly string[];
  initialTargetDayKey?: string;
  colors: Theme;
  copySlotToDateRange: (
    sourceDayKey: string,
    sourceSlot: string,
    targetSlot: string,
    targetDayKeys: string[],
  ) => Promise<CopySlotOutcome>;
  undoCopyToSlot: (createdIdsByDay: Record<string, string[]>) => void;
  insetTop: number;
};

export default function CopySlotSheetHost({
  copySlotTarget,
  onClose,
  dayKey,
  mealGroups,
  slots,
  initialTargetDayKey,
  colors,
  copySlotToDateRange,
  undoCopyToSlot,
  insetTop,
}: Props) {
  const copySlotToast = useToast();

  return (
    <>
      {copySlotTarget && (() => {
        const sourceSlot = copySlotTarget.slot;
        const count = (mealGroups[sourceSlot] ?? []).length;
        return (
          <CopyMealSheet
            visible={true}
            onClose={onClose}
            sourceDayKey={dayKey}
            sourceSlot={sourceSlot}
            slots={slots}
            initialTargetDayKey={initialTargetDayKey}
            mealLabel={`${count} item${count === 1 ? "" : "s"}`}
            onConfirm={(targetDayKeys, targetSlot, summary) => {
              if (targetDayKeys.length === 0) {
                copySlotToast.showToast("Nothing to copy", { variant: "info" });
                return;
              }
              void copySlotToDateRange(dayKey, sourceSlot, targetSlot, targetDayKeys).then(
                (result) => {
                  if (result.itemCount === 0) {
                    copySlotToast.showToast("Nothing to copy", { variant: "info" });
                    return;
                  }
                  // `summary` already reads "Copied to <day(s)>[ · <Slot>]"
                  // (day/slot-centric — it doesn't know the item count,
                  // shared as it is between the single-item and whole-slot
                  // sheets). Splice the item count in right after "Copied "
                  // for the past-tense toast phrasing, e.g. "Copied 3 items
                  // to Tue 22 Jul · Lunch".
                  const itemWord = result.itemCount === 1 ? "item" : "items";
                  const destination = summary.replace(/^Copied /, "");
                  copySlotToast.showToast(`Copied ${result.itemCount} ${itemWord} ${destination}`, {
                    variant: "success",
                    action: {
                      label: "Undo",
                      onPress: () => undoCopyToSlot(result.createdIdsByDay),
                    },
                  });
                },
              );
            }}
            colors={colors}
          />
        );
      })()}

      <Toast
        visible={copySlotToast.visible}
        message={copySlotToast.message}
        variant={copySlotToast.variant}
        icon={copySlotToast.icon}
        action={copySlotToast.action}
        onDismiss={copySlotToast.dismissToast}
        inset={insetTop + Spacing.sm}
        testID="today-copy-slot-toast"
      />
    </>
  );
}
