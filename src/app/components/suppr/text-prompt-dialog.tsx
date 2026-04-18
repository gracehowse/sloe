"use client";

/**
 * TextPromptDialog — themed single-text-input prompt (audit M7,
 * 2026-04-18). Drop-in replacement for `window.prompt(title, default)`
 * call sites that just need a trimmed, non-empty string back.
 *
 * Why it exists:
 *  - `window.prompt` is an unthemed native browser dialog — no
 *    dark-mode support, synchronous, blocks the main thread, and does
 *    not integrate with the app's accessibility tree the way Radix
 *    dialogs do.
 *  - Radix's `Dialog` gives focus trap, labelled title + description,
 *    and `Escape` / overlay-click cancel handling for free.
 *
 * Behaviour:
 *  - Input is trimmed before being passed to `onConfirm`.
 *  - Empty input disables Save and is treated like Cancel.
 *  - `Enter` submits; `Escape` cancels (Radix default).
 *  - `currentValue` pre-fills the input on open (for rename cases).
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

export type TextPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short dialog title, e.g. `"Rename plan"`. */
  title: React.ReactNode;
  /** Optional longer description shown below the title. */
  description?: React.ReactNode;
  /** Label above the input. Defaults to `"Name"`. */
  inputLabel?: string;
  /** Placeholder shown when the input is empty. */
  placeholder?: string;
  /** Pre-fills the input when the dialog opens. */
  currentValue?: string;
  /** Character cap applied to the `<input>` element. Defaults to 80. */
  maxLength?: number;
  /** Label on the confirm button. Defaults to `"Save"`. */
  confirmLabel?: string;
  /** Label on the cancel button. Defaults to `"Cancel"`. */
  cancelLabel?: string;
  /**
   * Called with the trimmed input when the user taps Save. Return a
   * promise to disable the Save button until the parent finishes.
   */
  onConfirm: (value: string) => void | Promise<void>;
};

export function TextPromptDialog({
  open,
  onOpenChange,
  title,
  description,
  inputLabel = "Name",
  placeholder,
  currentValue = "",
  maxLength = 80,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  onConfirm,
}: TextPromptDialogProps) {
  const [value, setValue] = React.useState(currentValue);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValue(currentValue);
      setSaving(false);
    }
  }, [open, currentValue]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onConfirm(trimmed);
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
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-muted-foreground">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">{inputLabel}</span>
            <Input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus
              maxLength={maxLength}
              aria-label={inputLabel}
              aria-required="true"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {cancelLabel}
          </Button>
          <Button onClick={handleSave} disabled={!canSave} aria-disabled={!canSave}>
            {saving ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TextPromptDialog;
