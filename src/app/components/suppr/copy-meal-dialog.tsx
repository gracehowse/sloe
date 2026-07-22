"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { SupprMark } from "../ui/suppr-mark";
import { addDays, sanitizeCopySlotTargets } from "../../../lib/nutrition/copyMeals";
import { formatMacroTrailer } from "../../../lib/nutrition/macroFormat";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `YYYY-MM-DD` key for the day the meal was originally logged. */
  sourceDayKey: string;
  /** Human label for the meal (shown in the title and toast). */
  mealLabel: string;
  /**
   * ENG-786 rebuild (2026-07-21) — this dialog now backs BOTH the
   * single-item "Copy meal" flow AND the whole-slot "Copy to another
   * day" flow, so both need a meal-slot choice. `slots` is the app's
   * enabled meal-slot labels (`enabledMealSlotLabels` upstream);
   * `sourceSlot` is the slot the copied item(s) currently live in and
   * seeds `targetSlot`'s default. Mirror of mobile's CopySheet slot
   * selector in `apps/mobile/hooks/useCopyDuplicateMeal.ts`.
   */
  slots: readonly string[];
  sourceSlot: string;
  /**
   * P5 parity (#7) — optional meal-identity inputs for the branded
   * header chrome (SupprMark + thumbnail + macro line). All optional: when
   * omitted, the branded header degrades to the SupprMark + title only.
   * Mirrors mobile's MealActionSheet copy chrome
   * (apps/mobile/.../TodayMealsSection.tsx:308-353).
   * `redesign_branded_sheets` collapsed (ENG-1651) — this chrome is
   * permanently ON via REDESIGN_DEFAULT_ON; the legacy plain header is gone.
   */
  mealThumbUrl?: string | null;
  mealMacros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  /**
   * ENG-786 rebuild — when the viewed source day is in the past, the
   * host passes today's date key here so the default target is "today"
   * rather than "source + 1 day" (which would otherwise still be in the
   * past). Omitted (or unset) keeps the original source+1 default.
   */
  initialTargetDayKey?: string;
  /** Called with the target days, the chosen target slot, and a
   *  human-readable summary for the toast. */
  onConfirm: (targetDayKeys: string[], targetSlot: string, summary: string) => void;
};

type QuickRange = "none" | "+2" | "+3" | "+7";

const QUICK_RANGES: Array<{ key: QuickRange; label: string; days: number }> = [
  { key: "+2", label: "Next 2 days", days: 2 },
  { key: "+3", label: "Next 3 days", days: 3 },
  { key: "+7", label: "Next 7 days", days: 7 },
];

function formatHumanDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Shared pill-button treatment for every segmented row in this dialog
 * (meal-slot picker + quick-range chips) — one definition instead of a
 * per-row copy so a third row (ENG-786 rebuild's slot picker) doesn't
 * triplicate the className string.
 */
function pillButtonClassName(active: boolean): string {
  return `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
    active
      ? "bg-primary text-primary-foreground border-primary"
      : "bg-card text-foreground border-border hover:border-primary/40"
  }`;
}

/**
 * CopyMealDialog — single-destination date picker with optional
 * "also copy to next N days" chips, plus a target meal-slot picker.
 *
 * Behaviour:
 *  - Default target is the day after the source (or `initialTargetDayKey`
 *    when the host passes one — e.g. "today" when viewing a past day).
 *  - Quick-range chips extend the list starting from the chosen primary date.
 *  - Target slot defaults to `sourceSlot`; picking a different slot is a
 *    legal same-day target too (renaming Lunch -> Dinner on today).
 *  - Source day+slot is excluded automatically by the shared
 *    `sanitizeCopySlotTargets` (same day is only a no-op when the slot is
 *    ALSO unchanged).
 *  - Confirm is disabled when no valid target remains (e.g. user picked the
 *    source day with the source slot still selected).
 *  - Branded header is always on (`redesign_branded_sheets` collapsed,
 *    ENG-1651); the legacy plain header is gone.
 */
export function CopyMealDialog({
  open,
  onOpenChange,
  sourceDayKey,
  mealLabel,
  slots,
  sourceSlot,
  mealThumbUrl,
  mealMacros,
  initialTargetDayKey,
  onConfirm,
}: Props) {
  const defaultTarget = useMemo(
    () => initialTargetDayKey ?? addDays(sourceDayKey, 1),
    [sourceDayKey, initialTargetDayKey],
  );
  const [targetDateKey, setTargetDateKey] = useState(defaultTarget);
  const [quickRange, setQuickRange] = useState<QuickRange>("none");
  const [targetSlot, setTargetSlot] = useState(sourceSlot);

  // Reset whenever the dialog (re)opens so a new source doesn't leak state.
  useEffect(() => {
    if (open) {
      setTargetDateKey(defaultTarget);
      setQuickRange("none");
      setTargetSlot(sourceSlot);
    }
  }, [open, defaultTarget, sourceSlot]);

  const targetDayKeys = useMemo(() => {
    const base: string[] = [targetDateKey];
    if (quickRange !== "none") {
      const range = QUICK_RANGES.find((r) => r.key === quickRange);
      if (range) {
        for (let i = 1; i < range.days; i += 1) {
          base.push(addDays(targetDateKey, i));
        }
      }
    }
    return sanitizeCopySlotTargets(sourceDayKey, sourceSlot, targetSlot, base);
  }, [targetDateKey, quickRange, sourceDayKey, sourceSlot, targetSlot]);

  const canConfirm = targetDayKeys.length > 0;

  // Slot suffix only ever appended when the target slot actually differs
  // from the source — leaves the original phrasing byte-identical for the
  // (still-default) same-slot case.
  const slotChanged = targetSlot !== sourceSlot;

  const summary = useMemo(() => {
    if (targetDayKeys.length === 0) return "Nothing to copy";
    const base =
      targetDayKeys.length === 1
        ? `Copied to ${formatHumanDate(targetDayKeys[0]!)}`
        : `Copied to ${targetDayKeys.length} days`;
    return slotChanged ? `${base} · ${targetSlot}` : base;
  }, [targetDayKeys, slotChanged, targetSlot]);

  const handleConfirm = () => {
    if (!canConfirm) {
      onConfirm([], targetSlot, "Nothing to copy");
      onOpenChange(false);
      return;
    }
    onConfirm(targetDayKeys, targetSlot, summary);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          {/* P5 parity (#7) — branded header: quiet SupprMark + thumbnail +
              title + macro line, matching mobile's MealActionSheet copy
              chrome. Thumbnail/macros render only when the host passes them;
              the mark + title always show. `redesign_branded_sheets`
              collapsed (ENG-1651) — always on. */}
          <div
            data-testid="copy-meal-branded-header"
            className="flex items-center gap-2.5"
          >
            {mealThumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mealThumbUrl}
                alt=""
                className="h-10 w-10 rounded-lg object-cover shrink-0"
              />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 shrink-0">
                <SupprMark size={20} className="opacity-60" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1 text-left">
              <span className="flex items-center gap-1.5">
                {mealThumbUrl ? (
                  <SupprMark size={14} className="opacity-50 shrink-0" aria-hidden />
                ) : null}
                <DialogTitle className="truncate text-foreground">
                  {mealLabel}
                </DialogTitle>
              </span>
              {mealMacros ? (
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {formatMacroTrailer(mealMacros)}
                </span>
              ) : null}
            </span>
          </div>
          <DialogDescription className="text-muted-foreground">
            Copy to another day — pick a day and, optionally, a short range.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Target day</span>
            <input
              type="date"
              value={targetDateKey}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setTargetDateKey(v);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm"
              aria-label="Target day"
            />
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Meal slot</span>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTargetSlot(slot)}
                  aria-pressed={targetSlot === slot}
                  className={pillButtonClassName(targetSlot === slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Also copy to</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setQuickRange("none")}
                aria-pressed={quickRange === "none"}
                className={pillButtonClassName(quickRange === "none")}
              >
                Just this day
              </button>
              {QUICK_RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setQuickRange(r.key)}
                  aria-pressed={quickRange === r.key}
                  className={pillButtonClassName(quickRange === r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {targetDayKeys.length === 0
              ? "Nothing to copy — pick a day or slot other than the source."
              : targetDayKeys.length === 1
                ? `Will copy to ${formatHumanDate(targetDayKeys[0]!)}${slotChanged ? ` · ${targetSlot}` : ""}.`
                : `Will copy to ${targetDayKeys.length} days (${formatHumanDate(targetDayKeys[0]!)} – ${formatHumanDate(
                    targetDayKeys[targetDayKeys.length - 1]!,
                  )})${slotChanged ? ` · ${targetSlot}` : ""}.`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CopyMealDialog;
