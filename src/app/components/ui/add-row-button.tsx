"use client";

import * as React from "react";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { Icons } from "./icons";
import { cn } from "./utils";

export type AddRowButtonSize = "md" | "sm";

export type AddRowButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  label: React.ReactNode;
  /** `sm` — compact inline variant (planner add-slot chips); mirrors mobile. */
  size?: AddRowButtonSize;
  /** Leading glyph override — defaults to the Plus. */
  icon?: React.ReactNode;
  /** Async commit in flight — swaps the glyph for a spinner + disables. */
  loading?: boolean;
};

/**
 * AddRowButton — the ONE add-row / AddControl grammar (web).
 *
 * The AddControl ruling (2026-07-10, ENG-1375 S4 —
 * `docs/decisions/2026-07-10-chip-grammar-soft-tint.md` §AddControl): every
 * in-card "add another X" affordance is a quiet-fill row — `bg-fill-quiet`,
 * radius 12 (12-inside-24 inset), Plus glyph + primary-solid semibold label,
 * full-width in-card. NO border, NO second card. DASHED borders are upload
 * dropzones ONLY (photo-log, RecipeUpload) — never an add-row action.
 *
 * ENG-1662 / anatomy: under `ui_anatomy_owners_v1` the row is LEFT-ALIGNED
 * (panel form) so it reads as an InsetPanel-with-action, not a squashed
 * centred pill. Flag-off keeps the legacy centred label (kill switch).
 *
 * Extracted from the canonical pair: `today-meals-section.tsx` "Add food"
 * pill (web) ↔ mobile `TodayMealsSection` — the FIRST quiet-fill adoption
 * (F-160 / flat-card surfaces, 2026-06-12).
 *
 * Mobile mirror: `apps/mobile/components/ui/AddRowButton.tsx`.
 */
export function AddRowButton({
  label,
  icon,
  loading = false,
  disabled,
  className,
  type = "button",
  size = "md",
  ...rest
}: AddRowButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const sm = size === "sm";
  const panelForm = isFeatureEnabled("ui_anatomy_owners_v1");
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "flex w-full items-center rounded-[12px] bg-fill-quiet",
        panelForm ? "justify-start" : "justify-center",
        sm ? "gap-1 px-2 py-1 text-[11px]" : "gap-2 px-3 py-2 text-sm",
        "font-semibold text-primary-solid",
        "transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isDisabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Icons.spinner className={cn(sm ? "h-3 w-3" : "h-4 w-4", "shrink-0 animate-spin")} aria-hidden />
      ) : (
        (icon ?? <Icons.add className={cn(sm ? "h-3 w-3" : "h-4 w-4", "shrink-0")} aria-hidden />)
      )}
      {label}
    </button>
  );
}
