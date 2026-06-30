"use client";

/**
 * CSV import preview (web) — the confirm step of the two-phase MFP-refugee
 * import (ENG-1234). Rendered inside `<MfpCsvImportCard>` once the route's
 * `?mode=preview` parse comes back, BEFORE anything is written. Shows the
 * detected source, how many meals will import, and a sample of the parsed
 * rows so the user can trust the columns mapped correctly — then commits
 * (or backs out to pick a different file).
 *
 * Pure presentation: all flow/analytics live in the shared
 * `useCsvImportFlow` hook. Mobile mirror:
 * `apps/mobile/components/imports/CsvImportPreview.tsx`.
 */
import * as React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { CsvSampleRow } from "@/lib/imports/useCsvImportFlow";
import { csvSourceLabel, mealSlotLabel } from "@/lib/imports/csvSourceLabel";

export function CsvImportPreview({
  source,
  total,
  unmatched,
  truncated,
  sample,
  committing,
  onConfirm,
  onCancel,
}: {
  source: string;
  total: number;
  unmatched: number;
  truncated: boolean;
  sample: CsvSampleRow[];
  committing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const sourceName = csvSourceLabel(source);
  const remaining = Math.max(0, total - sample.length);

  return (
    <div className="mt-3" data-testid="mfp-csv-preview">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Found{" "}
        <span className="font-bold text-foreground">
          {total} meal{total === 1 ? "" : "s"}
        </span>{" "}
        in your {sourceName} export. Your macros stay exactly as you logged
        them — here&rsquo;s a sample:
      </p>

      <ul className="mt-3 space-y-2" data-testid="mfp-csv-preview-rows">
        {sample.map((row, i) => (
          <li
            key={`${row.date}-${row.name}-${i}`}
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
          >
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-solid">
              {mealSlotLabel(row.meal)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {row.name}
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
              {row.calories == null ? "—" : `${Math.round(row.calories)} kcal`}
            </span>
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          + {remaining} more meal{remaining === 1 ? "" : "s"}
        </p>
      )}

      {unmatched > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {unmatched} row{unmatched === 1 ? "" : "s"} will be skipped (missing
          calories).
        </p>
      )}
      {truncated && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Only the first 1000 rows are included — upload again for older
          history.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 flex-1"
          onClick={onConfirm}
          disabled={committing}
          data-testid="mfp-csv-confirm-import"
        >
          {committing ? (
            <>
              <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Importing…
            </>
          ) : (
            <>
              Import {total} meal{total === 1 ? "" : "s"}
              <ArrowRight className="size-3.5 ml-1.5" />
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9"
          onClick={onCancel}
          disabled={committing}
          data-testid="mfp-csv-cancel-preview"
        >
          Choose another
        </Button>
      </div>
    </div>
  );
}
