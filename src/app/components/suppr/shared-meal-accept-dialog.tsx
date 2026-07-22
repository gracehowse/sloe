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
import { MEAL_SLOTS, isMealSlot, type MealSlot } from "../../../lib/nutrition/mealSlots";
import { addDays, todayKey } from "../../../lib/nutrition/copyMeals";
import { formatMacroTrailer } from "../../../lib/nutrition/macroFormat";
import { mealShareTotals, type MealSharePayload } from "../../../lib/share/mealShareLink";
import { isFeatureEnabled } from "../../../lib/analytics/track";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: MealSharePayload | null;
  onConfirm: (dayKey: string, slot: MealSlot) => void;
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Same chip grammar as the meal-slot radio chips below (active fill +
// focus-visible ring) — one treatment per surface inside this dialog.
const dayChipClass = (active: boolean) =>
  `rounded-full border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
    active
      ? "border-primary-soft bg-primary-soft text-foreground"
      : "border-border text-foreground-secondary hover:bg-muted"
  }`;

/**
 * SharedMealAcceptDialog — ENG-1642 recipient-side confirm sheet for a
 * resolved `get_meal_share` payload: pick the target day + slot, then hand
 * off to the caller's insert path via `onConfirm(dayKey, slot)`.
 *
 * Mirrors `CopyMealDialog`'s scaffolding — same `Dialog`/date-input/quick-
 * chip shape, same `redesign_branded_sheets` gate for the header chrome
 * (branded: SupprMark tile + title + macro-trailer subline; flag-off:
 * plain title/description). Renders `null` when there's no payload yet —
 * the host (Today surface) is expected to only flip `open` true once a
 * lookup has resolved to `"ok"`.
 */
export function SharedMealAcceptDialog({ open, onOpenChange, payload, onConfirm }: Props) {
  const brandedSheets = isFeatureEnabled("redesign_branded_sheets");
  const [dayKey, setDayKey] = useState(() => todayKey());
  const [slot, setSlot] = useState<MealSlot>("Breakfast");

  // Reset whenever the dialog (re)opens so a stale pick doesn't leak
  // across different shares reusing the same mounted dialog.
  useEffect(() => {
    if (!open || !payload) return;
    setDayKey(todayKey());
    setSlot(isMealSlot(payload.mealSlot) ? payload.mealSlot : "Breakfast");
  }, [open, payload]);

  const totals = useMemo(() => (payload ? mealShareTotals(payload.items) : null), [payload]);
  const today = todayKey();
  const tomorrow = useMemo(() => addDays(today, 1), [today]);
  const canConfirm = DATE_KEY_RE.test(dayKey);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(dayKey, slot);
    onOpenChange(false);
  };

  if (!payload || !totals) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          {brandedSheets ? (
            <>
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft shrink-0">
                  <SupprMark size={20} className="opacity-60" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <DialogTitle className="truncate text-foreground">{payload.title}</DialogTitle>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {formatMacroTrailer(totals)}
                  </span>
                </span>
              </div>
              <DialogDescription className="text-muted-foreground">
                {payload.sharedBy ? `From ${payload.sharedBy} — ` : ""}
                Choose when to add it to your log.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="text-foreground">Add shared meal to your log</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {`"${payload.title}" — ${formatMacroTrailer(totals)}`}
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
            {payload.items.map((item, i) => (
              <div key={`${item.recipeTitle}-${i}`} className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{item.recipeTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMacroTrailer({
                    calories: item.calories,
                    protein: item.protein,
                    carbs: item.carbs,
                    fat: item.fat,
                    fiber: item.fiberG,
                  })}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Add to</span>
            <div role="radiogroup" aria-label="Meal slot" className="flex gap-2">
              {MEAL_SLOTS.map((s) => {
                const active = slot === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSlot(s)}
                    className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                      active
                        ? "border-primary-soft bg-primary-soft text-foreground"
                        : "border-border text-foreground-secondary hover:bg-muted"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Day</span>
            <input
              type="date"
              value={dayKey}
              onChange={(e) => {
                const v = e.target.value;
                if (DATE_KEY_RE.test(v)) setDayKey(v);
              }}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              aria-label="Day to log to"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDayKey(today)}
              aria-pressed={dayKey === today}
              className={dayChipClass(dayKey === today)}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDayKey(tomorrow)}
              aria-pressed={dayKey === tomorrow}
              className={dayChipClass(dayKey === tomorrow)}
            >
              Tomorrow
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Add to my log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SharedMealAcceptDialog;
