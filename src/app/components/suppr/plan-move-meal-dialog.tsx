"use client";

import { useMemo } from "react";
import {
  Coffee,
  Cookie,
  Sun,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { DayPlan } from "../../../types/recipe.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const SLOT_ICON: Record<string, LucideIcon> = {
  Breakfast: Coffee,
  Lunch: Sun,
  Dinner: UtensilsCrossed,
  Snacks: Cookie,
  Snack: Cookie,
};

function slotIcon(name: string): LucideIcon {
  return SLOT_ICON[name] ?? UtensilsCrossed;
}

type MoveFrom = { day: number; slotIndex: number } | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: DayPlan[];
  from: MoveFrom;
  /** Labels aligned with plan[i] by index. */
  dayLabels: string[];
  onMove: (to: { day: number; slotIndex: number }) => void;
};

/**
 * Web parity for mobile `MoveMealSheet` — pick a destination slot in the week.
 * Uses shared `moveMealInPlan` semantics via the parent's `onMove` callback.
 */
export function PlanMoveMealDialog({
  open,
  onOpenChange,
  plan,
  from,
  dayLabels,
  onMove,
}: Props) {
  const rows = useMemo(() => {
    const out: {
      day: number;
      slotIndex: number;
      dayLabel: string;
      slotName: string;
      recipeTitle: string;
      calories: number;
      isSource: boolean;
      isEmpty: boolean;
    }[] = [];
    for (const [di, dp] of plan.entries()) {
      const dayLabel = dayLabels[di] ?? `Day ${dp.day}`;
      dp.meals.forEach((m, si) => {
        out.push({
          day: dp.day,
          slotIndex: si,
          dayLabel,
          slotName: m.name,
          recipeTitle: m.recipeTitle ?? "",
          calories: Math.round(m.calories ?? 0),
          isSource: !!from && from.day === dp.day && from.slotIndex === si,
          isEmpty: !!m.isPlaceholder || !m.recipeTitle,
        });
      });
    }
    return out;
  }, [plan, dayLabels, from]);

  const sourceRow = rows.find((r) => r.isSource);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">Move meal</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {sourceRow
              ? sourceRow.isEmpty
                ? `From: ${sourceRow.slotName} · ${sourceRow.dayLabel}`
                : `From: ${sourceRow.slotName} · ${sourceRow.dayLabel} · ${sourceRow.recipeTitle} · ${sourceRow.calories} kcal`
              : "Pick a slot"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No slots available.</p>
          ) : (
            rows.map((r) => {
              const Icon = slotIcon(r.slotName);
              const label = `Move to ${r.dayLabel} ${r.slotName}`;
              return (
                <button
                  key={`${r.day}-${r.slotIndex}`}
                  type="button"
                  disabled={r.isSource}
                  aria-label={label}
                  onClick={() => {
                    onMove({ day: r.day, slotIndex: r.slotIndex });
                    onOpenChange(false);
                  }}
                  className={`flex items-center gap-3 w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    r.isSource
                      ? "border-primary bg-primary/10 opacity-80 cursor-default"
                      : "border-border bg-background hover:bg-muted/60 cursor-pointer"
                  }`}
                >
                  <span
                    className="grid place-items-center shrink-0 rounded-full bg-muted"
                    style={{ width: 28, height: 28 }}
                    aria-hidden
                  >
                    <Icon size={14} className="text-muted-foreground" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-foreground truncate">
                      {r.dayLabel} · {r.slotName}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate mt-0.5">
                      {r.isEmpty
                        ? "Empty slot"
                        : `${r.recipeTitle}${r.calories > 0 ? ` · ${r.calories} kcal` : ""}`}
                    </span>
                  </span>
                  {r.isSource ? (
                    <span className="text-[11px] font-bold tracking-wide text-primary shrink-0">
                      FROM
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
