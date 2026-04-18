"use client";

/**
 * RenameSavedMealDialog — themed dialog for renaming a saved meal from
 * the Quick Add "Usual meals" tab (audit M7, 2026-04-18; copy aligned
 * Ship M1).
 *
 * Replaces the previous `window.prompt("Rename meal", ...)` call site
 * inside `quick-add-panel.tsx`. Behaviour is unchanged:
 *  - Name is trimmed (`normaliseSavedMealName`).
 *  - Empty names and name === current name are no-ops.
 *  - Length is capped at `SAVED_MEAL_NAME_MAX_LENGTH` (80) to match the
 *    save-combo dialog's `maxLength` so every name accepted at create
 *    time stays acceptable at rename time.
 *
 * The dialog itself does no I/O — it just captures the user's input and
 * hands a valid, normalised name back to the parent via `onConfirm`.
 * Persistence, optimistic UI, and toast handling stay where they live
 * (the Quick Add panel's `handleRename` callback) so the failure-mode
 * wiring does not have to be duplicated.
 *
 * Mobile parity: mobile uses `Alert.prompt` which is the native iOS
 * pattern and does not need this primitive.
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
import { Input } from "../ui/input";
import {
  SAVED_MEAL_NAME_MAX_LENGTH,
  normaliseSavedMealName,
} from "../../../lib/nutrition/savedMeals";

export type RenameSavedMealDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current name of the meal being renamed. Pre-fills the input. */
  currentName: string;
  /**
   * Called with the validated, trimmed, length-clipped name when the
   * user taps Save. The parent is responsible for the actual rename
   * call (optimistic state + supabase write + toast). Return a promise
   * to disable the Save button until the parent finishes.
   *
   * Not called when the new name is empty or equals `currentName`.
   */
  onConfirm: (nextName: string) => void | Promise<void>;
};

export function RenameSavedMealDialog({
  open,
  onOpenChange,
  currentName,
  onConfirm,
}: RenameSavedMealDialogProps) {
  const [value, setValue] = React.useState(currentName);
  const [saving, setSaving] = React.useState(false);

  // Reset when the dialog opens so a previous edit can't bleed over.
  React.useEffect(() => {
    if (open) {
      setValue(currentName);
      setSaving(false);
    }
  }, [open, currentName]);

  const trimmed = value.trim();
  const normalised = normaliseSavedMealName(value);
  const isChange = normalised != null && normalised !== currentName.trim();
  const canSave = isChange && !saving;

  const handleSave = async () => {
    if (!canSave || !normalised) return;
    setSaving(true);
    try {
      await onConfirm(normalised);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Rename meal</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Give this meal a new name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Name</span>
            <Input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. My usual breakfast"
              autoFocus
              maxLength={SAVED_MEAL_NAME_MAX_LENGTH}
              aria-label="Meal name"
              aria-required="true"
            />
          </label>
          {trimmed.length === 0 ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Name can&apos;t be empty.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave} aria-disabled={!canSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RenameSavedMealDialog;
