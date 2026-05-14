"use client";

/**
 * DestructiveConfirmDialog — single themed destructive-confirmation
 * primitive used across the web app (audit M7, 2026-04-18).
 *
 * Why it exists:
 *  - `window.confirm(...)` is an unthemed native browser dialog — no
 *    dark-mode support, synchronous, blocks the main thread, and has an
 *    inconsistent UX across browsers.
 *  - Radix's `AlertDialog` already gives us a focus trap, labelled
 *    title + description, and `Escape` / overlay-click cancel handling.
 *    This wrapper standardises the copy and button roles so every
 *    "are you sure you want to delete this?" moment in the product
 *    looks + behaves the same.
 *
 * Accessibility:
 *  - Radix marks the confirm button as destructive via the `destructive`
 *    variant of `<Button>` (red background).
 *  - `AlertDialogTitle` + `AlertDialogDescription` are announced by
 *    screen readers when the dialog opens.
 *  - Cancel is visually the primary / focused button so a careless
 *    keyboard press does not delete something.
 *
 * Mobile parity:
 *  - Mobile already uses `Alert.alert` which is the native iOS pattern
 *    and does not need this wrapper.
 */

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { buttonVariants } from "../ui/button";
import { cn } from "../ui/utils";

export type DestructiveConfirmDialogProps = {
  /** Controlled open state. */
  open: boolean;
  /** Called by Radix when the user taps Cancel, Escape, or the overlay. */
  onOpenChange: (open: boolean) => void;
  /** Short, factual title. E.g. `Delete "Oats with berries"?`. */
  title: React.ReactNode;
  /** Optional longer explanation. Often `"This can't be undone."`. */
  description?: React.ReactNode;
  /** Label on the destructive action button. Defaults to `"Delete"`. */
  confirmLabel?: string;
  /** Label on the cancel button. Defaults to `"Cancel"`. */
  cancelLabel?: string;
  /**
   * Called when the user taps the destructive action. Return a promise
   * to disable the button while the caller does async work; the dialog
   * closes itself once the promise resolves.
   */
  onConfirm: () => void | Promise<void>;
  /**
   * 2026-05-12 (premium-bar audit web parity, DC9): when supplied,
   * the confirm action requires the user to type this exact string
   * into a TextInput before the destructive CTA enables. Apple's
   * pattern for irreversible destruction — friction proportional to
   * consequence. Mirror of mobile `SettingsBundleContent` Erase-
   * Everything modal. Pass `"RESET"` to gate erase-everything.
   */
  typeToConfirm?: string;
};

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  typeToConfirm,
}: DestructiveConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);
  // 2026-05-12 — type-to-confirm gate. When `typeToConfirm` is set,
  // the destructive CTA stays disabled until the user types the
  // matching string. Reset on every open so a re-show requires
  // fresh confirmation.
  const [typedConfirm, setTypedConfirm] = React.useState("");
  React.useEffect(() => {
    if (!open) setTypedConfirm("");
  }, [open]);
  const gateMatched =
    !typeToConfirm || typedConfirm === typeToConfirm;

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Let us control closing so a thrown confirm handler leaves the
    // dialog open (Radix would otherwise close on its own).
    event.preventDefault();
    if (pending) return;
    if (!gateMatched) return;
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className="text-muted-foreground">
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        {typeToConfirm ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              Type{" "}
              <span className="font-bold text-destructive">{typeToConfirm}</span>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder={typeToConfirm}
              data-testid="destructive-confirm-input"
              className={`w-full rounded-md border bg-background px-3 py-2.5 text-center text-base font-bold tracking-[0.1em] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive ${
                typedConfirm === typeToConfirm
                  ? "border-destructive"
                  : "border-border"
              }`}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending || !gateMatched}
            data-testid="destructive-confirm-cta"
            className={cn(
              buttonVariants({ variant: "destructive" }),
              !gateMatched && "opacity-40 pointer-events-none",
            )}
          >
            {pending ? `${confirmLabel}…` : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DestructiveConfirmDialog;
