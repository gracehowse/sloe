"use client";

/**
 * MFP CSV import card (web).
 *
 * Closes the MFP-refugee history-bridge gap (P1 customer-lens). Used in
 * two places:
 *
 *   1. Onboarding terminal step (`data-bridges.tsx`) — 4th card alongside
 *      manual targets / notifications / recipe URL. Brings meal history
 *      into Suppr from day 1 so Today renders something familiar.
 *   2. Settings -> Privacy & Security — same card so a user who skipped
 *      onboarding can import later.
 *
 * Two-phase (ENG-1234): picking a file uploads to `?mode=preview`, which
 * parses WITHOUT writing — the card then shows the detected source, the
 * count, and a sample of the parsed rows (`<CsvImportPreview>`). Only when
 * the user confirms does the card re-send the same file to `?mode=commit`
 * to insert. The shared `useCsvImportFlow` hook owns the state machine +
 * analytics so web and mobile drive an identical flow.
 *
 * Mobile mirror at `apps/mobile/components/imports/MfpCsvImportCard.tsx`.
 */

import * as React from "react";
import { Check, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { SupprCard } from "@/app/components/ui/suppr-card";
import { supabase } from "@/lib/supabase/browserClient";
import { AnalyticsEvents } from "@/lib/analytics/events";
import type { AnalyticsEventName } from "@/lib/analytics/events";
import { track, isFeatureEnabled } from "@/lib/analytics/track";
import { useCsvImportFlow } from "@/lib/imports/useCsvImportFlow";
import type { CsvUploadResult } from "@/lib/imports/useCsvImportFlow";
import { CsvImportPreview } from "@/app/components/imports/CsvImportPreview";
import { NamedTrackerReassuranceStrip } from "@/app/components/imports/NamedTrackerReassuranceStrip";

export function MfpCsvImportCard({
  surface = "onboarding",
  highlightApp = null,
}: {
  surface?: "onboarding" | "settings";
  /** ENG-990 — when the user picked an importable app on the app-choice
   *  step, the data-bridges step passes its display name (e.g.
   *  "MyFitnessPal") so this card leads with their app and reads as the
   *  pre-selected next step. `null` keeps the generic multi-app copy. */
  highlightApp?: string | null;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const flow = useCsvImportFlow({
    surface,
    platform: "web",
    track: (event, props) => track(event as AnalyticsEventName, props),
    events: {
      started: AnalyticsEvents.mfp_csv_import_started,
      previewed: AnalyticsEvents.mfp_csv_import_previewed,
      completed: AnalyticsEvents.mfp_csv_import_completed,
      failed: AnalyticsEvents.mfp_csv_import_failed,
    },
  });
  const { state } = flow;

  // Fire a success toast once, on the transition into the success state.
  const importedOnce =
    state.kind === "success" ? state.imported : null;
  React.useEffect(() => {
    if (importedOnce != null) {
      toast.success(
        `Imported ${importedOnce} meal${importedOnce === 1 ? "" : "s"}.`,
      );
    }
  }, [importedOnce]);

  const handlePick = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = React.useCallback(
    (file: File) => {
      // The uploader is reused by the hook for both the preview and the
      // commit round-trip — it grabs a fresh bearer each call (the token
      // can rotate between preview and confirm) and posts the same file
      // with the right `?mode=`.
      const uploader = async (
        mode: "preview" | "commit",
      ): Promise<CsvUploadResult> => {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          // Resolve a synthetic auth failure rather than hitting the
          // network — the hook surfaces it via the error state.
          return {
            httpOk: false,
            status: 401,
            json: {
              ok: false,
              error: "unauthorized",
              message: "Sign in to import your history.",
            },
          };
        }
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/imports/mfp-csv?mode=${mode}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const json = await res.json();
        return { httpOk: res.ok, status: res.status, json };
      };

      void flow.startPreview(file.name, uploader);
    },
    [flow],
  );

  // ENG-990 — lead with the user's app when they told us they're
  // switching from one we can import. `highlightApp` is `null` on the
  // generic Settings surface and when no importable app was chosen.
  const highlighted = highlightApp != null;
  const reassuranceStrip =
    isFeatureEnabled("mfp_tracker_reassurance_v1") && !highlighted && state.kind === "idle";
  const title = highlighted
    ? `Bring your ${highlightApp} history`
    : "Import from another app";
  const body = highlighted
    ? `Upload your ${highlightApp} CSV export and we'll bring your meal history into Sloe — your numbers stay exactly as you logged them.`
    : "MyFitnessPal, Lose It, or Cronometer — upload the CSV export and we'll bring your meal history into Sloe without changing the macros you already logged.";

  return (
    <SupprCard
      padding="lg"
      radius="xl"
      tone={
        state.kind === "success"
          ? "success"
          : highlighted && state.kind === "idle"
            ? "primary"
            : "neutral"
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="CSV file to import"
        data-testid="mfp-csv-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          // Allow re-picking the same file after cancel/error.
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <div className="flex items-start gap-3">
        <span
          className="size-9 shrink-0 rounded-full bg-primary/15 text-primary-solid grid place-items-center"
          aria-hidden
        >
          <FileSpreadsheet className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-sm font-bold text-foreground tracking-tight">
              {title}
            </h3>
            {state.kind === "success" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-success-soft)] px-2 py-0.5 text-[10px] font-bold text-success">
                <Check className="size-2.5" />
                Imported
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {body}
          </p>

          {reassuranceStrip ? <NamedTrackerReassuranceStrip /> : null}

          {state.kind === "idle" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-9"
              onClick={handlePick}
              data-testid="mfp-csv-choose-file"
            >
              Choose CSV file
            </Button>
          )}

          {state.kind === "previewing" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Reading {state.fileName}&hellip;</span>
            </div>
          )}

          {state.kind === "preview" && (
            <CsvImportPreview
              source={state.source}
              total={state.total}
              unmatched={state.unmatched}
              truncated={state.truncated}
              sample={state.sample}
              committing={state.committing}
              onConfirm={flow.confirm}
              onCancel={flow.reset}
            />
          )}

          {state.kind === "success" && (
            <div className="mt-3 flex items-start gap-2 text-xs text-success">
              <Check
                className="size-3.5 mt-px shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
              <div className="flex-1">
                <div className="font-semibold">
                  Imported {state.imported} meal
                  {state.imported === 1 ? "" : "s"}
                </div>
                {state.unmatched > 0 && (
                  <div className="text-muted-foreground mt-0.5">
                    {state.unmatched} row{state.unmatched === 1 ? "" : "s"}{" "}
                    skipped (missing calories).
                  </div>
                )}
                {state.truncated && (
                  <div className="text-muted-foreground mt-0.5">
                    First 1000 rows imported — upload again for older history.
                  </div>
                )}
              </div>
            </div>
          )}

          {state.kind === "error" && (
            <div className="mt-3">
              <div className="text-xs text-destructive mb-2" role="alert">
                {state.message}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handlePick}
                className="h-9"
                data-testid="mfp-csv-retry"
              >
                <RotateCcw className="size-3.5 mr-1.5" /> Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </SupprCard>
  );
}
