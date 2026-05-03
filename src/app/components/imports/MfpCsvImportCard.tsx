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
 * Behaviour:
 *   - File picker accepts `.csv` only. The `accept` attribute is just
 *     the visible filter; the API does the real validation (anyone can
 *     hand-edit the picker's accept list).
 *   - On upload: POST to `/api/imports/mfp-csv` with the file as the
 *     multipart `file` field, plus the user's bearer token.
 *   - States: idle -> uploading -> success | error. Error has a retry
 *     button that re-opens the picker — no silent drops.
 *   - Success copy: "Imported N meals from MyFitnessPal." (parity with
 *     mobile).
 *   - Analytics: `mfp_csv_import_started` on file pick,
 *     `_completed` / `_failed` on response. Same event names on
 *     mobile.
 *
 * Mobile mirror at `apps/mobile/components/imports/MfpCsvImportCard.tsx`.
 */

import * as React from "react";
import { Check, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { supabase } from "@/lib/supabase/browserClient";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | {
      kind: "success";
      imported: number;
      unmatched: number;
      truncated: boolean;
    }
  | { kind: "error"; message: string };

type ImportSuccess = {
  ok: true;
  imported: number;
  unmatched: number;
  truncated: boolean;
};

type ImportFailure = {
  ok: false;
  error: string;
  message?: string;
};

export function MfpCsvImportCard({
  surface = "onboarding",
}: {
  surface?: "onboarding" | "settings";
}) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handlePick = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = React.useCallback(
    async (file: File) => {
      track(AnalyticsEvents.mfp_csv_import_started, {
        surface,
        platform: "web",
      });
      setPhase({ kind: "uploading", fileName: file.name });

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          setPhase({
            kind: "error",
            message: "Sign in to import your MyFitnessPal history.",
          });
          track(AnalyticsEvents.mfp_csv_import_failed, {
            error: "unauthorized",
            status: 401,
            surface,
            platform: "web",
          });
          return;
        }

        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/imports/mfp-csv", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const json = (await res.json()) as ImportSuccess | ImportFailure;

        if (!res.ok || !json.ok) {
          const message =
            ("message" in json && json.message) ||
            (res.status === 429
              ? "Too many imports today. Try again tomorrow."
              : res.status === 413
                ? "File is too large. Split your export and try again."
                : "Import failed. Try again or pick a different file.");
          setPhase({ kind: "error", message });
          track(AnalyticsEvents.mfp_csv_import_failed, {
            error: "error" in json ? json.error : "unknown",
            status: res.status,
            surface,
            platform: "web",
          });
          return;
        }

        setPhase({
          kind: "success",
          imported: json.imported,
          unmatched: json.unmatched,
          truncated: json.truncated,
        });
        track(AnalyticsEvents.mfp_csv_import_completed, {
          imported: json.imported,
          unmatched: json.unmatched,
          truncated: json.truncated,
          surface,
          platform: "web",
        });
        toast.success(
          `Imported ${json.imported} meal${json.imported === 1 ? "" : "s"} from MyFitnessPal.`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Import failed.";
        setPhase({ kind: "error", message });
        track(AnalyticsEvents.mfp_csv_import_failed, {
          error: "fetch_failed",
          status: 0,
          surface,
          platform: "web",
        });
      } finally {
        // Allow picking the same file again after a failed attempt.
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [surface],
  );

  return (
    <div
      className={`rounded-2xl border bg-card p-4 ${
        phase.kind === "success" ? "border-emerald-500/40" : "border-border"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="MyFitnessPal CSV file"
        data-testid="mfp-csv-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <div className="flex items-start gap-3">
        <span
          className="size-9 shrink-0 rounded-lg bg-primary/15 text-primary grid place-items-center"
          aria-hidden
        >
          <FileSpreadsheet className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-sm font-bold text-foreground tracking-tight">
              Import from MyFitnessPal
            </h3>
            {phase.kind === "success" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                <Check className="size-2.5" />
                Imported
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Upload your MFP CSV export — we&rsquo;ll bring your meal history
            into Suppr without changing the macros you already logged.
          </p>

          {phase.kind === "idle" && (
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

          {phase.kind === "uploading" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Importing {phase.fileName}&hellip;</span>
            </div>
          )}

          {phase.kind === "success" && (
            <div className="mt-3 flex items-start gap-2 text-xs text-emerald-500">
              <Check
                className="size-3.5 mt-px shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
              <div className="flex-1">
                <div className="font-semibold">
                  Imported {phase.imported} meal
                  {phase.imported === 1 ? "" : "s"} from MyFitnessPal
                </div>
                {phase.unmatched > 0 && (
                  <div className="text-muted-foreground mt-0.5">
                    {phase.unmatched} row{phase.unmatched === 1 ? "" : "s"}{" "}
                    skipped (missing calories).
                  </div>
                )}
                {phase.truncated && (
                  <div className="text-muted-foreground mt-0.5">
                    First 1000 rows imported — upload again for older history.
                  </div>
                )}
              </div>
            </div>
          )}

          {phase.kind === "error" && (
            <div className="mt-3">
              <div className="text-xs text-destructive mb-2" role="alert">
                {phase.message}
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
    </div>
  );
}
