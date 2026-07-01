"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import {
  importFlaggedReviewLine,
  importFlaggedSummary,
  type ImportQualityRecipe,
} from "@/lib/recipes/importQualitySignal.ts";

export type ImportReviewFlaggedNoteProps = {
  recipe: ImportQualityRecipe;
};

/**
 * ENG-1283 — the calm, honest "some ingredients need review" note on the web
 * import review. Mirror of the mobile `ImportReviewFlaggedNote`. Renders NOTHING
 * when nothing is flagged (a clean import stays a silent success). Derives from
 * the SHARED `importFlaggedSummary` predicate — no nutrition recompute, no
 * parser / floor / legal / persistence touch.
 *
 * Body-neutral, non-alarming, non-blocking: it informs the under-count, it
 * never stops the user saving. Flag-gating is the caller's job so flag-OFF is
 * today's render exactly.
 */
export function ImportReviewFlaggedNote({ recipe }: ImportReviewFlaggedNoteProps) {
  const summary = importFlaggedSummary(recipe);
  const line = importFlaggedReviewLine(summary);
  if (!line) return null;
  return (
    <div
      data-testid="import-review-flagged-note"
      role="status"
      className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground"
    >
      <AlertCircle aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />
      <p>{line}</p>
    </div>
  );
}
