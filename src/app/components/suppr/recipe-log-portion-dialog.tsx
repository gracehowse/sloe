"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "../ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.tsx";
import { PortionPickerWeb } from "./portion-picker.tsx";
import { formatMacro } from "../../../lib/nutrition/formatMacro.ts";
import {
  buildRecipeStructuredLogPicker,
  formatRecipePortionLogLabel,
  recipePortionSelectionFromPickerState,
  scaleRecipeLogMacros,
} from "../../../lib/recipes/recipeLogPortion.ts";
import type { RecipeMacroPanel, RecipeYieldDefinition } from "../../../lib/nutrition/recipeYield.ts";
import type { PortionState } from "../../../lib/nutrition/portionPicker.ts";
import { canLogRecipeByUnits } from "../../../lib/nutrition/recipeYield.ts";

export type RecipeLogPortionConfirmPayload = {
  portion: ReturnType<typeof recipePortionSelectionFromPickerState>;
  portionLabel: string;
  macros: RecipeMacroPanel;
};

export type RecipeLogPortionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeTitle: string;
  perServing: RecipeMacroPanel;
  baseServings: number;
  yieldDef: RecipeYieldDefinition;
  logging?: boolean;
  onConfirm: (payload: RecipeLogPortionConfirmPayload) => void | Promise<void>;
};

export function RecipeLogPortionDialog({
  open,
  onOpenChange,
  recipeTitle,
  perServing,
  baseServings,
  yieldDef,
  logging = false,
  onConfirm,
}: RecipeLogPortionDialogProps) {
  const pickerOptions = React.useMemo(
    () => buildRecipeStructuredLogPicker(perServing, baseServings, yieldDef),
    [perServing, baseServings, yieldDef],
  );

  const unitsOnly =
    pickerOptions == null && canLogRecipeByUnits(yieldDef) && yieldDef.kind === "units";

  const [pickerState, setPickerState] = React.useState<PortionState | null>(
    pickerOptions?.initial ?? null,
  );
  const [unitsCount, setUnitsCount] = React.useState(1);

  React.useEffect(() => {
    if (!open) return;
    setPickerState(pickerOptions?.initial ?? null);
    setUnitsCount(1);
  }, [open, pickerOptions]);

  const portion = React.useMemo(() => {
    if (unitsOnly && yieldDef.kind === "units") {
      return { mode: "units" as const, units: unitsCount };
    }
    if (!pickerState) return null;
    return recipePortionSelectionFromPickerState(pickerState);
  }, [unitsOnly, yieldDef, unitsCount, pickerState]);

  const preview = React.useMemo(() => {
    if (!portion) return null;
    return scaleRecipeLogMacros(perServing, baseServings, yieldDef, portion);
  }, [portion, perServing, baseServings, yieldDef]);

  const handleConfirm = async () => {
    if (!portion || !preview) {
      toast.error("Choose a portion to log.");
      return;
    }
    if (preview.calories <= 0 && preview.protein <= 0 && preview.carbs <= 0 && preview.fat <= 0) {
      toast.error("Portion has no macros — verify the recipe first.");
      return;
    }
    await onConfirm({
      portion,
      portionLabel: formatRecipePortionLogLabel(portion, yieldDef),
      macros: preview,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !logging && onOpenChange(next)}>
      <DialogContent className="max-w-md" data-testid="recipe-log-portion-dialog">
        <DialogHeader>
          <DialogTitle>Log portion</DialogTitle>
          <DialogDescription>
            How much of <span className="font-semibold text-foreground">{recipeTitle}</span> are you
            logging?
          </DialogDescription>
        </DialogHeader>

        {pickerOptions && pickerState ? (
          <PortionPickerWeb
            product={{}}
            value={pickerState}
            onChange={setPickerState}
            options={pickerOptions}
            hideQuickChips
          />
        ) : unitsOnly && yieldDef.kind === "units" ? (
          <div className="flex items-center justify-center gap-4 py-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={logging || unitsCount <= 1}
              onClick={() => setUnitsCount((n) => Math.max(1, n - 1))}
              aria-label="Decrease"
            >
              −
            </Button>
            <span className="min-w-[4rem] text-center text-xl font-bold tabular-nums">
              {unitsCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={logging}
              onClick={() => setUnitsCount((n) => n + 1)}
              aria-label="Increase"
            >
              +
            </Button>
            <span className="text-sm text-muted-foreground">
              {unitsCount === 1 ? yieldDef.singular : yieldDef.plural}
            </span>
          </div>
        ) : null}

        {preview ? (
          <p className="text-center text-sm text-muted-foreground tabular-nums">
            ≈ {formatMacro(preview.calories, "calories", " kcal")} · P{" "}
            {formatMacro(preview.protein, "protein")} · C {formatMacro(preview.carbs, "carbs")} · F{" "}
            {formatMacro(preview.fat, "fat")}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={logging}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={logging || !preview}>
            {logging ? "Logging…" : "Log to Today"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecipeLogPortionDialog;
