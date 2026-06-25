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

/**
 * v3 prototype `GoPublic` attestation flow (ENG-1247 A9): the live dialog
 * shipped a single "I created this" checkbox; the prototype gates publishing
 * on THREE honest attestations — creator/adaptation, nutrition-is-an-estimate,
 * and photo-rights — with the Publish CTA disabled until all three are ticked.
 * Copy is taken verbatim from the prototype (`docs/ux/redesign/v3/Sloe-App.html`,
 * the GoPublic `items` array). Mobile is import-only by design, so this surface
 * stays web-only (see docs decision: recipe Go-Public is web-only).
 */
const ATTESTATIONS = [
  {
    key: "own",
    title: "This is my own recipe or my adaptation",
    subtitle: "Not copied word-for-word from a book or another site",
  },
  {
    key: "nutri",
    title: "Nutrition is my best, honest estimate",
    subtitle: "Sloe labels it as creator-estimated for everyone",
  },
  {
    key: "rights",
    title: "I have the rights to any photo I add",
    subtitle: "No images I don’t own",
  },
] as const;

type AttestationKey = (typeof ATTESTATIONS)[number]["key"];
type AttestationState = Record<AttestationKey, boolean>;

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
  const [att, setAtt] = useState<AttestationState>({
    own: false,
    nutri: false,
    rights: false,
  });
  const [internalOpen, setInternalOpen] = useState(props.autoOpen ?? false);
  const triggerLabel = props.triggerLabel ?? "Go public";
  const all = att.own && att.nutri && att.rights;

  // Audit 2026-04-30 visual-qa P1 #12 — dark-mode native checkbox.
  // Styled with `accent-primary` + a border-on-card foreground so it stays
  // visible on both light and dark dialog surfaces. Native input kept (over
  // the prototype's custom `exp-check` plate) for built-in a11y + keyboard.
  const checkboxClass =
    "mt-1 h-4 w-4 shrink-0 rounded border border-border bg-background accent-primary";

  // Shared body + footer so the autoOpen and trigger paths can't drift (the
  // single-checkbox version duplicated the whole block in both branches).
  const body = (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Publish this recipe?</AlertDialogTitle>
        <AlertDialogDescription>
          Publishing{" "}
          <span className="font-medium text-foreground">{props.recipeTitle}</span>{" "}
          to your profile. A couple of quick confirmations first.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border">
        {ATTESTATIONS.map((item) => (
          <label
            key={item.key}
            className="flex items-start gap-3 cursor-pointer p-4"
          >
            <input
              type="checkbox"
              className={checkboxClass}
              checked={att[item.key]}
              onChange={(e) =>
                setAtt((prev) => ({ ...prev, [item.key]: e.target.checked }))
              }
            />
            <span className="min-w-0">
              <span className="block text-sm text-foreground">{item.title}</span>
              <span className="block text-xs text-muted-foreground">
                {item.subtitle}
              </span>
            </span>
          </label>
        ))}
      </div>
      {!all ? (
        <p className="text-xs text-muted-foreground -mt-2">
          Tick all three to enable Publish.
        </p>
      ) : null}
    </>
  );

  const footer = (
    <AlertDialogFooter>
      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
      <AlertDialogAction
        className="rounded-xl"
        disabled={!all}
        onClick={() => {
          if (!all) return;
          props.onConfirmPublish();
        }}
      >
        Publish
      </AlertDialogAction>
    </AlertDialogFooter>
  );

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
          {body}
          {footer}
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
        {body}
        {footer}
      </AlertDialogContent>
    </AlertDialog>
  );
}
