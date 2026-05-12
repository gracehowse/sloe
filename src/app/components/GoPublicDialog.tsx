"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog.tsx";

export function GoPublicDialog(props: {
  disabled?: boolean;
  recipeTitle: string;
  onConfirmPublish: () => void;
  triggerLabel?: string;
  /**
   * Audit 2026-04-30 visual-qa P0 #3 — when `true` the dialog opens
   * immediately without rendering its own trigger button. Used by the
   * RecipeDetail mobile meatball menu, which already provided the
   * trigger as a `<DropdownMenuItem>`.
   */
  autoOpen?: boolean;
  /**
   * Pairs with `autoOpen`. Fires when the user dismisses the dialog
   * (cancel, overlay click, escape) so the host can clear the flag
   * that asked for it to open in the first place.
   */
  onAutoOpenClose?: () => void;
}) {
  const [attest, setAttest] = useState(false);
  const [internalOpen, setInternalOpen] = useState(props.autoOpen ?? false);
  const triggerLabel = props.triggerLabel ?? "Go public";

  // Audit 2026-04-30 visual-qa P1 #12 — dark-mode native checkbox.
  // The native input is now styled with `accent-primary` and a
  // proper border-on-card foreground so it remains visible on both
  // light and dark dialog surfaces. The `attest` flag also drives a
  // helper line so users understand why Publish is disabled.
  const checkboxClass =
    "mt-1 h-4 w-4 rounded border border-border bg-background accent-primary";

  if (props.autoOpen) {
    return (
      <AlertDialog
        open={internalOpen}
        onOpenChange={(next) => {
          setInternalOpen(next);
          if (!next) props.onAutoOpenClose?.();
        }}
      >
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              Publishing makes <span className="font-medium text-foreground">{props.recipeTitle}</span>{" "}
              visible to others. Only publish recipes you created and have the right to share.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-4 bg-muted/40">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={attest}
              onChange={(e) => setAttest(e.target.checked)}
            />
            <span className="text-sm text-foreground">
              I created this recipe and I have the right to share it publicly.
            </span>
          </label>
          {!attest ? (
            <p className="text-xs text-muted-foreground -mt-2">
              Tick the box above to enable Publish.
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              disabled={!attest}
              onClick={() => {
                if (!attest) return;
                props.onConfirmPublish();
              }}
            >
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={props.disabled}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {triggerLabel}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border border-border rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Publish this recipe?</AlertDialogTitle>
          <AlertDialogDescription>
            Publishing makes <span className="font-medium text-foreground">{props.recipeTitle}</span>{" "}
            visible to others. Only publish recipes you created and have the right to share.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-4 bg-muted/40">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={attest}
            onChange={(e) => setAttest(e.target.checked)}
          />
          <span className="text-sm text-foreground">
            I created this recipe and I have the right to share it publicly.
          </span>
        </label>
        {!attest ? (
          <p className="text-xs text-muted-foreground -mt-2">
            Tick the box above to enable Publish.
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl"
            disabled={!attest}
            onClick={() => {
              if (!attest) return;
              props.onConfirmPublish();
            }}
          >
            Publish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

