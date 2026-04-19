"use client";

/**
 * ActivityLevelPickerDialog — Settings-side picker (build 10 fix E-2,
 * 2026-04-19). Opens from the Settings → "Activity level" row. Uses
 * the shared `ActivityLevelPreview` component so the math is identical
 * to onboarding, and delegates the recompute to
 * `recomputeTargetsForActivity` (same pipeline onboarding saveAndFinish
 * uses).
 *
 * Closes TestFlight `AIIm60n` + `AHCSYMATS` — tester had no in-app
 * surface to see or change her stored `activity_level`, so her
 * Maintenance number stayed stuck at 1,900.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { ActivityLevelPreview } from "./activity-level-preview";
import type {
  ActivityLevel,
  NutritionStrategy,
  PlanPace,
  Sex,
} from "../../../lib/nutrition/tdee";

export type ActivityLevelPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The level currently stored in `profiles.activity_level`. */
  currentLevel: ActivityLevel;
  /** Profile basics needed for the live preview + recompute. */
  sex: Sex;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  goal?: string | null;
  planPace?: PlanPace | null;
  nutritionStrategy?: NutritionStrategy | null;
  /** Called with the new level when the user taps Save. Parent is
   *  responsible for the Supabase write + toast. Returning a promise
   *  disables Save until it settles. */
  onConfirm: (nextLevel: ActivityLevel) => void | Promise<void>;
};

export function ActivityLevelPickerDialog({
  open,
  onOpenChange,
  currentLevel,
  sex,
  weightKg,
  heightCm,
  age,
  onConfirm,
}: ActivityLevelPickerDialogProps) {
  const [selected, setSelected] = React.useState<ActivityLevel>(currentLevel);
  const [saving, setSaving] = React.useState(false);

  // Reset when the dialog reopens so a previous unsaved selection
  // doesn't leak between sessions.
  React.useEffect(() => {
    if (open) {
      setSelected(currentLevel);
      setSaving(false);
    }
  }, [open, currentLevel]);

  const dirty = selected !== currentLevel;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onConfirm(selected);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            How active are you on a typical day?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Used to estimate your baseline calorie burn before workouts and steps.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <ActivityLevelPreview
            sex={sex}
            weightKg={weightKg}
            heightCm={heightCm}
            age={age}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            aria-disabled={!dirty || saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityLevelPickerDialog;
