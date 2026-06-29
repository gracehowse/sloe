"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { SupprButton } from "../suppr/suppr-button";
import { PlanSourceSelector } from "../PlanSourceSelector";
import {
  CALORIE_FLOOR_MAX,
  CALORIE_FLOOR_MIN,
  CALORIE_FLOOR_STEP,
  clampCalorieFloor,
  type MealsPerDay,
  type PlanAdjustConstraints,
} from "@/lib/planning/planAdjustConstraints";

export interface AdjustConstraintsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: PlanAdjustConstraints;
  libraryCount: number;
  discoverCount: number;
  saving?: boolean;
  onSave: (next: PlanAdjustConstraints) => void;
}

/**
 * AdjustConstraintsSheet — v3 Plan header sliders sheet (ENG-1247 / B1).
 * Web parity twin of `apps/mobile/components/plan/AdjustConstraintsSheet.tsx`.
 */
export function AdjustConstraintsSheet({
  open,
  onOpenChange,
  initial,
  libraryCount,
  discoverCount,
  saving = false,
  onSave,
}: AdjustConstraintsSheetProps) {
  const [draft, setDraft] = React.useState(initial);

  React.useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  const setMealsPerDay = (mealsPerDay: MealsPerDay) =>
    setDraft((d) => ({ ...d, mealsPerDay }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-labelledby="adjust-constraints-title"
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
        <h2 id="adjust-constraints-title" className="text-lg font-bold text-foreground">
          Adjust constraints
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Shape how Sloe builds your week</p>

        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          <PlanSourceSelector
            mode={draft.source}
            onChange={(source) => setDraft((d) => ({ ...d, source }))}
            libraryCount={libraryCount}
            discoverCount={discoverCount}
          />
        </div>

        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Daily calorie floor</span>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {draft.calorieFloor.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Decrease calorie floor"
              className="flex size-9 items-center justify-center rounded-full border border-border"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  calorieFloor: clampCalorieFloor(d.calorieFloor - CALORIE_FLOOR_STEP),
                }))
              }
            >
              <Minus className="size-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {CALORIE_FLOOR_MIN.toLocaleString()}–{CALORIE_FLOOR_MAX.toLocaleString()}
            </span>
            <button
              type="button"
              aria-label="Increase calorie floor"
              className="flex size-9 items-center justify-center rounded-full border border-border"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  calorieFloor: clampCalorieFloor(d.calorieFloor + CALORIE_FLOOR_STEP),
                }))
              }
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-sm font-semibold text-foreground">Meals per day</p>
          <div className="mt-2 flex gap-2">
            {([3, 4] as const).map((n) => {
              const active = draft.mealsPerDay === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={active}
                  className={`flex-1 rounded-lg border py-2 text-sm font-bold ${
                    active
                      ? "border-primary-solid bg-primary/10 text-primary-solid"
                      : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setMealsPerDay(n)}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Allow batch & leftovers
              </span>
              <span className="block text-xs text-muted-foreground">
                Cook once, repeat across the week
              </span>
            </span>
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={draft.allowBatchLeftovers}
              onChange={(e) =>
                setDraft((d) => ({ ...d, allowBatchLeftovers: e.target.checked }))
              }
            />
          </label>
        </div>

        <SupprButton
          variant="primary"
          className="mt-5 w-full"
          disabled={saving}
          onClick={() => onSave(draft)}
          data-testid="adjust-constraints-save"
        >
          {saving ? "Saving…" : "Save & regenerate"}
        </SupprButton>
      </div>
    </div>
  );
}

export default AdjustConstraintsSheet;
