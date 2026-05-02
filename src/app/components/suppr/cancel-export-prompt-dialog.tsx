"use client";

import * as React from "react";
import { Download, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

/**
 * CancelExportPromptDialog — web parity for the mobile
 * `CancelExportPromptSheet` (PR claude/cancel-flow-export-prompt,
 * 2026-05-02).
 *
 * Calm-tone trust posture: surfaces "take your data with you" before
 * routing the user to the Stripe billing portal. NEVER blocks; both
 * options are equal-weight visually.
 *
 * Wired into `src/app/components/Settings.tsx` as the "Manage
 * subscription" entry. The host owns the data-fetch + blob-download
 * + portal hop so this component stays purely presentational.
 */
export interface CancelExportPromptDialogProps {
  open: boolean;
  /** "Take your data with you" — host fetches `nutrition_entries` and
   *  triggers a CSV download. Returns the row count for the success
   *  state. `null` on failure (host is responsible for surfacing the
   *  error toast / alert). */
  onExport: () => Promise<{ rowCount: number } | null>;
  /** "Continue cancelling" — host navigates to `/account/billing`
   *  (Stripe customer portal). */
  onContinueCancelling: () => void;
  /** Backdrop / Escape / close button. Equivalent to the dialog
   *  closing without a decision. */
  onClose: () => void;
}

export function CancelExportPromptDialog({
  open,
  onExport,
  onContinueCancelling,
  onClose,
}: CancelExportPromptDialogProps) {
  const [exporting, setExporting] = React.useState(false);
  const [exportedRowCount, setExportedRowCount] = React.useState<number | null>(null);

  // Reset internal state when the dialog closes so the next open
  // doesn't show a stale "Exported N entries" line.
  React.useEffect(() => {
    if (!open) {
      setExporting(false);
      setExportedRowCount(null);
    }
  }, [open]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await onExport();
      if (result) setExportedRowCount(result.rowCount);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-center">
            Before you go
          </DialogTitle>
          <DialogDescription className="text-sm text-center text-muted-foreground px-2">
            Your data is yours. You can take it with you, or carry on to
            the cancellation page — whichever you prefer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            data-testid="cancel-export-take-data-row"
            aria-label="Take your data with you"
            className="w-full text-left rounded-xl border border-border px-4 py-3 hover:bg-accent/40 transition-colors disabled:opacity-70"
          >
            <div className="flex items-center">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{
                  background: "var(--primary-soft, rgba(76,108,224,0.12))",
                }}
              >
                <Download className="h-4 w-4 text-primary" />
              </span>
              <div className="flex-1 ml-3 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  Take your data with you
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {exportedRowCount != null
                    ? `Exported ${exportedRowCount.toLocaleString("en-GB")} entries.`
                    : exporting
                      ? "Preparing your CSV…"
                      : "Download your full nutrition log as a CSV."}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </button>

          <button
            type="button"
            onClick={onContinueCancelling}
            data-testid="cancel-export-continue-row"
            aria-label="Continue cancelling"
            className="w-full text-left rounded-xl border border-border px-4 py-3 hover:bg-accent/40 transition-colors"
          >
            <div className="flex items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 bg-muted">
                <ArrowRight className="h-4 w-4 text-foreground" />
              </span>
              <div className="flex-1 ml-3 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  Continue cancelling
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Open your subscription page to cancel.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CancelExportPromptDialog;
