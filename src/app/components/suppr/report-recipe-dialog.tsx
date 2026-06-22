"use client";

import * as React from "react";
import { AlertTriangle, Copyright, HelpCircle, ShieldAlert, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

/**
 * ReportRecipeDialog — per-recipe "Report an issue" sheet (ENG-1225 #19,
 * UGC-safety + the IP launch bundle ENG-857/858/859).
 *
 * Routing is honest — no report is silently dropped:
 *   - Copyright / "I own this" → the existing DMCA takedown form at `/dmca`,
 *     pre-filled with the recipe id (real flow → `dmca_takedowns` via
 *     `/api/dmca-takedown`).
 *   - Everything else → a pre-filled email to support (the real support
 *     channel; there is no general report table yet — see follow-up).
 *
 * Mirror target: `apps/mobile/app/recipe/[id].tsx` (mobile parity follow-up).
 */
const SUPPORT_EMAIL = "support@getsloe.com";

type ReportReason = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  kind: "dmca" | "email";
};

// Copy reviewed by legal-reviewer (ENG-1225 #19): a *recipe* (ingredients +
// method) isn't copyrightable — only its creative expression is — so the label
// avoids "I own this recipe"; and we "start a request", never promise a takedown.
const REASONS: ReportReason[] = [
  {
    key: "copyright",
    label: "Copyright — this is my content",
    hint: "Starts a copyright takedown request with our team.",
    icon: Copyright,
    kind: "dmca",
  },
  {
    key: "incorrect",
    label: "Incorrect nutrition or instructions",
    hint: "Wrong calories, steps, or ingredients.",
    icon: AlertTriangle,
    kind: "email",
  },
  {
    key: "unsafe",
    label: "Inappropriate or unsafe",
    hint: "Offensive content or an unsafe cooking method.",
    icon: ShieldAlert,
    kind: "email",
  },
  {
    key: "other",
    label: "Something else",
    hint: "Tell us what's wrong.",
    icon: HelpCircle,
    kind: "email",
  },
];

export interface ReportRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeTitle?: string;
  /** Injectable for tests; defaults to a real navigation. */
  navigate?: (href: string) => void;
}

export function ReportRecipeDialog({
  open,
  onOpenChange,
  recipeId,
  recipeTitle,
  navigate,
}: ReportRecipeDialogProps) {
  // "sent" holds an in-dialog acknowledgement after a non-copyright report, so
  // the report never silently evaporates if the user's mail client doesn't open
  // (legal-reviewer Finding 2). Reset whenever the dialog (re)opens.
  const [sent, setSent] = React.useState(false);
  React.useEffect(() => {
    if (open) setSent(false);
  }, [open]);

  const go = (href: string) => {
    if (navigate) navigate(href);
    else if (typeof window !== "undefined") window.location.href = href;
  };

  const handle = (reason: ReportReason) => {
    const title = recipeTitle?.trim() || `recipe ${recipeId}`;
    if (reason.kind === "dmca") {
      go(`/dmca?recipe=${encodeURIComponent(recipeId)}`);
      onOpenChange(false);
      return;
    }
    const subject = encodeURIComponent(`Recipe report — ${title}`);
    const body = encodeURIComponent(
      `Recipe: ${title} (id: ${recipeId})\nReason: ${reason.label}\n\nWhat's wrong?\n`,
    );
    go(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm" data-testid="report-recipe-dialog">
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">Thanks for flagging this</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                We&apos;ve opened an email to our team. If your mail app
                didn&apos;t open, write to{" "}
                <a className="underline text-foreground/80" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                . We review reports within 5 business days — reporting flags
                content for review and doesn&apos;t guarantee removal.
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="report-done"
              className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-primary-solid px-4 text-sm font-medium text-primary-foreground hover:bg-primary-solid/90"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">Report an issue</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                What&apos;s wrong with this recipe? Copyright claims go to our
                DMCA team; everything else reaches support. We respond within 5
                business days.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-1">
              {REASONS.map((reason) => {
                const Icon = reason.icon;
                return (
                  <button
                    key={reason.key}
                    type="button"
                    onClick={() => handle(reason)}
                    data-testid={`report-reason-${reason.key}`}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{reason.label}</span>
                      <span className="block text-[12px] text-muted-foreground">{reason.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ReportRecipeDialog;
