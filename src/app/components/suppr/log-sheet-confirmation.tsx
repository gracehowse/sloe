"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { isFeatureEnabled } from "@/lib/analytics/track";
import { formatQualifiedKcal } from "../../../lib/nutrition/formatMacro";
import { SupprButton } from "./suppr-button";
import { SourceDot } from "../ui/source-dot";
import type { LogSheetProps } from "./log-sheet";

/**
 * S13 logged-confirmation (Figma 202:2) — the calm success state shown
 * after a log commits. Presentation-only: the host has already persisted
 * the log; this surface just confirms it and offers Done / Undo. Trust
 * posture: nutrition is always an estimate (never an absolute claim).
 *
 * Extracted from `log-sheet.tsx` (ENG-1484, screen-budget ratchet) —
 * mirror of mobile `LogSheetConfirmation.tsx`.
 */
export function LoggedConfirmation({
  confirmation,
}: {
  confirmation: NonNullable<LogSheetProps["confirmation"]>;
}) {
  const { title, kcal, kcalIsVerified, slot, source, onDone, onUndo } = confirmation;
  // ENG-1484 — kcal-qualifier cross-surface consistency: behind the
  // `kcal_trust_qualifier_v1` ramp this surface speaks the same `~` grammar
  // as every other decision surface (planner totals, Cook Mode, north-star,
  // Library) instead of its own "Est." wording. Flag OFF keeps the exact
  // pre-ENG-1484 copy (kill switch). Mirrors mobile `LogSheetConfirmation`.
  const kcalLine = isFeatureEnabled("kcal_trust_qualifier_v1")
    ? `${formatQualifiedKcal(kcal, kcalIsVerified)} kcal`
    : `Est. ${kcal} kcal`;
  return (
    <div
      data-slot="log-sheet-confirmation"
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center px-5 pb-6 pt-8 text-center"
    >
      {/* Success mark — Sloe sage success tint, calm not loud. */}
      <div className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
        <Check className="size-8" strokeWidth={2.5} aria-hidden />
      </div>

      <h2 className="mt-4 font-[family-name:var(--font-headline)] text-[22px] font-medium tracking-tight text-foreground-brand">
        Logged{slot ? ` to ${slot}` : ""}
      </h2>

      {/* Logged-item card — flat cream slab, 16px corner. Flat-card surfaces
          (2026-06-12, Withings grammar — decision:
          docs/decisions/2026-06-12-flat-card-surfaces.md): this nested resting
          card sits FLAT on the sheet ground — the retired soft lift
          (`--elev-card-soft`) and the hairline are both dropped; the card fill
          is the separation, matching `.card-slab`. */}
      <div className="mt-4 flex w-full items-center gap-3 rounded-[var(--radius-card-lg)] bg-card px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{title}</p>
          <div className="mt-1 flex items-center gap-1.5">
            {source ? <SourceDot source={source} size={6} /> : null}
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {kcalLine}
            </span>
          </div>
        </div>
      </div>

      {/* Actions — primary Done + optional ghost Undo. Button system
          (2026-06-12, docs/decisions/2026-06-12-button-system-solid-primary.md):
          the sheet's single commit action is the SOLID-plum SupprButton
          primary; the secondary Undo is the ghost variant. Mirror of mobile
          `LogSheet`. The sheet keeps its sanctioned elevation; the buttons
          inside carry none. */}
      <div className="mt-6 flex w-full flex-col gap-2">
        <SupprButton
          variant="primary"
          onClick={onDone}
          aria-label="Done"
          label="Done"
          className="w-full"
        />
        {onUndo ? (
          <SupprButton
            variant="ghost"
            onClick={onUndo}
            aria-label="Undo log"
            label="Undo"
            className="w-full"
          />
        ) : null}
      </div>
    </div>
  );
}
