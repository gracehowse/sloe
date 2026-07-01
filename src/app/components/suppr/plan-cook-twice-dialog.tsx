"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Repeat2 } from "lucide-react";
import type { DayPlan } from "../../../types/recipe.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

type From = { day: number; slotIndex: number } | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: DayPlan[];
  from: From;
  /** Labels aligned with plan[i] by index. */
  dayLabels: string[];
  /** Called with the 1-indexed `DayPlan.day` numbers to place leftovers on. */
  onConfirm: (targetDays: number[]) => void;
};

/**
 * ENG-958 "Cook once, eat twice" (web) — parity for mobile `PlanCookTwiceSheet`.
 * A quiet multi-select day picker: choose which later days you'll eat the
 * leftovers of the source meal. Placement is done by the shared
 * `repeatMealAsLeftovers` engine via the parent's `onConfirm` callback (which
 * skips days with no compatible free slot and reports the outcome).
 */
export function PlanCookTwiceDialog({ open, onOpenChange, plan, from, dayLabels, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Reset the selection whenever the dialog re-opens for a new source meal.
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open, from?.day, from?.slotIndex]);

  const source = useMemo(() => {
    if (!from) return null;
    const di = plan.findIndex((d) => d.day === from.day);
    const meal = di >= 0 ? plan[di]!.meals[from.slotIndex] : undefined;
    if (!meal) return null;
    return {
      recipeTitle: meal.recipeTitle ?? "",
      slotName: meal.name,
      dayLabel: dayLabels[di] ?? `Day ${from.day}`,
    };
  }, [from, plan, dayLabels]);

  // A leftover always lands on a LATER day than the cook (a real kitchen doesn't
  // serve the same dinner twice in one day) — offer only future days.
  const futureDays = useMemo(() => {
    if (!from) return [];
    return plan
      .map((dp, di) => ({ day: dp.day, dayLabel: dayLabels[di] ?? `Day ${dp.day}` }))
      .filter((d) => d.day > from.day);
  }, [plan, dayLabels, from]);

  const toggle = (day: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">Cook once, eat twice</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {source
              ? `${source.recipeTitle || source.slotName} · ${source.dayLabel} — pick the days you'll eat the leftovers.`
              : "Pick the days for leftovers."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {futureDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No later days in this plan to add leftovers to.</p>
          ) : (
            futureDays.map((d) => {
              const on = selected.has(d.day);
              return (
                <button
                  key={d.day}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Eat leftovers on ${d.dayLabel}`}
                  onClick={() => toggle(d.day)}
                  className={`flex items-center gap-3 w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    on
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted/60 cursor-pointer"
                  }`}
                >
                  <span
                    className={`grid place-items-center shrink-0 rounded-full ${on ? "bg-primary" : "bg-muted"}`}
                    style={{ width: 28, height: 28 }}
                    aria-hidden
                  >
                    {on ? (
                      <Check size={14} className="text-primary-foreground" />
                    ) : (
                      <Repeat2 size={14} className="text-muted-foreground" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0 block text-sm font-semibold text-foreground truncate">
                    {d.dayLabel}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={selected.size === 0}
            onClick={() => {
              onConfirm([...selected].sort((a, b) => a - b));
              onOpenChange(false);
            }}
          >
            {selected.size > 0 ? `Add leftovers · ${selected.size} day${selected.size === 1 ? "" : "s"}` : "Add leftovers"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
