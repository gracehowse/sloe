"use client";

import { Download, Settings as SettingsIcon, X } from "lucide-react";

/**
 * CancelExportPromptDialog — Suppr-owned interstitial that surfaces
 * the data-export prompt at the cancel touchpoint instead of leaving
 * it buried in Settings.
 *
 * Closes journey-architect P1: "The export prompt is buried deep in
 * Settings. A user who taps 'Manage subscription' and cancels never
 * sees the export prompt unless they actively look for it."
 *
 * Posture: calm trust, not retention-via-friction. Both options are
 * presented with EQUAL VISUAL WEIGHT — neither card is "highlighted
 * primary". The user is mid-cancel; we are not retention-engineering.
 *
 * Behaviour:
 *   - "Take your data with you" → host fires `onExport` (CSV download).
 *     The dialog stays open after export so the user can still tap
 *     "Continue to manage" or dismiss.
 *   - "Continue to manage" → host fires `onContinueToManage`. The
 *     dialog closes and the host routes to /account/billing (Stripe
 *     Customer Portal).
 *   - X / backdrop tap → dismiss without action.
 *
 * Mobile parity: `apps/mobile/components/settings/CancelExportPromptSheet.tsx`.
 */
export interface CancelExportPromptDialogProps {
  open: boolean;
  onDismiss: () => void;
  onExport: () => void;
  onContinueToManage: () => void;
  /** Optional preparing-export state; disables the export card while true. */
  exporting?: boolean;
}

export function CancelExportPromptDialog({
  open,
  onDismiss,
  onExport,
  onContinueToManage,
  exporting = false,
}: CancelExportPromptDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-export-prompt-title"
      data-testid="cancel-export-prompt-dialog"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h2
              id="cancel-export-prompt-title"
              className="text-base font-bold text-foreground"
            >
              Before you go
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Want a copy of your nutrition log first? You can do both — export
              now and still manage your subscription after.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {/* Equal-weight card #1 — export. Same border, same
              background, same icon-tile treatment as the second
              card. The user is mid-cancel; we do not visually
              privilege "stay" over "go". */}
          <button
            type="button"
            data-testid="cancel-export-prompt-export"
            onClick={onExport}
            disabled={exporting}
            aria-busy={exporting || undefined}
            className="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Take your data with you — export nutrition log first"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Download
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-foreground">
                Take your data with you
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                {exporting
                  ? "Preparing your file…"
                  : "Export your nutrition log as a CSV before any change."}
              </span>
            </span>
          </button>

          <button
            type="button"
            data-testid="cancel-export-prompt-continue"
            onClick={onContinueToManage}
            className="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Continue to manage subscription"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <SettingsIcon
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-foreground">
                Continue to manage
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                Open the Stripe billing portal to change or cancel your plan.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CancelExportPromptDialog;
