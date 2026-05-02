"use client";

import * as React from "react";
import { Check, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { supabase } from "@/lib/supabase/browserClient";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

/**
 * Data-bridges — onboarding step that lets the user import their
 * existing food history from another tracker. Closes the
 * MFP-refugee history-bridge gap (P1 customer-lens) and is the
 * 5th card on the data-bridges step (manual targets, Apple Health,
 * Notifications, Recipe URL, MFP CSV — last in the merge order).
 *
 * This file currently ships only the MFP CSV card. PR #28 (the
 * data-bridges step shell + the four sibling cards) merges around
 * the same window and will conflict here — the merge target is the
 * full 5-card layout.
 *
 * Behaviour:
 *   - File picker accepts `.csv` only. We rely on the `accept`
 *     attribute for the visible filter; the API does the real
 *     validation (anyone can hand-edit the picker's accept list).
 *   - On upload: POST to `/api/imports/mfp-csv` with the file as
 *     multipart `file` field, plus the user's bearer token.
 *   - States: idle → uploading → success | error. Error has a
 *     retry button that re-opens the picker — no silent drops.
 *   - Success copy: "Imported N meals from MyFitnessPal." (parity
 *     with mobile).
 *   - Analytics: `mfp_csv_import_started` on file pick,
 *     `_completed` / `_failed` on response. Same event names on
 *     mobile.
 */

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
        const json = (await res.json()) as
          | {
              ok: true;
              imported: number;
              unmatched: number;
              truncated: boolean;
            }
          | { ok: false; error: string; message?: string };

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
    <div className="bg-card border border-border rounded-xl p-4">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <div className="flex items-start gap-3">
        <span
          className="size-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center"
          aria-hidden
        >
          <FileSpreadsheet className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-foreground">
            Import from MyFitnessPal
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Upload your MFP CSV export — we'll bring your meal history
            into Suppr without changing the macros you already logged.
          </div>

          {phase.kind === "idle" && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={handlePick}
            >
              Choose CSV file
            </Button>
          )}

          {phase.kind === "uploading" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Importing {phase.fileName}…</span>
            </div>
          )}

          {phase.kind === "success" && (
            <div className="mt-3 flex items-start gap-2 text-xs text-success">
              <Check
                className="size-3.5 mt-px shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
              <div className="flex-1">
                <div className="font-semibold">
                  Imported {phase.imported} meal
                  {phase.imported === 1 ? "" : "s"}
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
              <div className="text-xs text-destructive mb-2">
                {phase.message}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handlePick}
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

/**
 * Default export step. Renders just the MFP card today; PR #28 will
 * merge in the four sibling cards (manual targets / Apple Health /
 * Notifications / Recipe URL).
 */
export function DataBridgesStep() {
  const overline = useStepOverline();
  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Bring in what you already track"
        subtitle="Optional. Skip any of these — you can connect them later from Settings."
      />
      <div className="flex flex-col gap-3">
        <MfpCsvImportCard surface="onboarding" />
      </div>
    </StepBody>
  );
}
