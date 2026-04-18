"use client";

/**
 * OverrideIngredientDialog (Batch 2.7) — let the user pin manual macros on
 * an existing ingredient row when the matched source is wrong. Number
 * inputs pre-fill from the current effective macros (override or match);
 * "Save" persists the override, "Reset" clears it.
 *
 * Dialog does not write to Supabase directly — the parent
 * (`RecipeDetail`) handles persistence. That keeps one write path and
 * makes the dialog testable.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { IngredientOverride } from "../../../types/recipe";
import { sanitizeOverrideInput } from "../../../lib/nutrition/ingredientOverrides";

export type OverrideIngredientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientName: string;
  /** Current effective macros (from the override, or the matched row). */
  currentMacros: { calories: number; protein: number; carbs: number; fat: number; fiber?: number };
  /** True when an override is already set — shows "Reset" button. */
  hasExistingOverride: boolean;
  /** Called with the new override when the user taps Save. */
  onSave: (override: IngredientOverride) => void | Promise<void>;
  /** Called when the user taps Reset — only shown when `hasExistingOverride`. */
  onReset: () => void | Promise<void>;
};

export function OverrideIngredientDialog({
  open,
  onOpenChange,
  ingredientName,
  currentMacros,
  hasExistingOverride,
  onSave,
  onReset,
}: OverrideIngredientDialogProps) {
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [fiber, setFiber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCal(String(Math.round(currentMacros.calories)));
      setP(String(Math.round(currentMacros.protein * 10) / 10));
      setC(String(Math.round(currentMacros.carbs * 10) / 10));
      setF(String(Math.round(currentMacros.fat * 10) / 10));
      setFiber(
        currentMacros.fiber != null
          ? String(Math.round(currentMacros.fiber * 10) / 10)
          : "",
      );
      setSaving(false);
    }
  }, [open, currentMacros]);

  const handleSave = async () => {
    const sanitized = sanitizeOverrideInput({
      calories: cal,
      protein: p,
      carbs: c,
      fat: f,
      fiber,
    });
    if (!sanitized) {
      // User cleared everything — treat as reset.
      if (hasExistingOverride) {
        await onReset();
      }
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(sanitized);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await onReset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Override nutrition</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {`Enter label values for "${ingredientName}". These replace the matched macros for this row.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ov-dlg-cal" className="text-xs text-muted-foreground">
              Calories (kcal)
            </Label>
            <Input
              id="ov-dlg-cal"
              type="number"
              inputMode="decimal"
              min="0"
              value={cal}
              onChange={(e) => setCal(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ov-dlg-p" className="text-xs text-muted-foreground">
              Protein (g)
            </Label>
            <Input
              id="ov-dlg-p"
              type="number"
              inputMode="decimal"
              min="0"
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ov-dlg-c" className="text-xs text-muted-foreground">
              Carbs (g)
            </Label>
            <Input
              id="ov-dlg-c"
              type="number"
              inputMode="decimal"
              min="0"
              value={c}
              onChange={(e) => setC(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ov-dlg-f" className="text-xs text-muted-foreground">
              Fat (g)
            </Label>
            <Input
              id="ov-dlg-f"
              type="number"
              inputMode="decimal"
              min="0"
              value={f}
              onChange={(e) => setF(e.target.value)}
            />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label htmlFor="ov-dlg-fiber" className="text-xs text-muted-foreground">
              Fiber (g) — optional
            </Label>
            <Input
              id="ov-dlg-fiber"
              type="number"
              inputMode="decimal"
              min="0"
              value={fiber}
              onChange={(e) => setFiber(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {hasExistingOverride ? (
            <Button
              variant="ghost"
              className="sm:mr-auto text-destructive hover:text-destructive"
              onClick={() => void handleReset()}
              disabled={saving}
            >
              Reset to match
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OverrideIngredientDialog;
