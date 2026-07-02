"use client";

import * as React from "react";
import { Bookmark, Sparkles, SlidersHorizontal } from "lucide-react";

import type { PlanWeekVerdict } from "@/lib/planning/planWeekStatus";

/**
 * PlanHeaderV3 — the Sloe v3 Plan header + week-verdict row.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanHeaderV3.tsx` (prototype
 * `docs/ux/redesign/v3/Sloe-App.html` Plan screen ~L4707–4721): the date-range
 * overline + "Your plan" serif title with three quiet round action buttons
 * (generate / adjust / templates), then a verdict row — a tone dot +
 * "On track — N of M days land" headline + "{M−N} days need a meal or swap"
 * nudge. The verdict comes from {@link PlanWeekVerdict} (`computePlanWeekVerdict`),
 * so completeness logic stays shared web↔mobile.
 *
 * `wide` (ENG-1303) — the DESKTOP dashboard variant, per the prototype's
 * `WebPlan` header (~L7626–7628): labelled buttons instead of icon squares
 * (outline "Adjust" + "Templates", the surface's ONE filled "Generate week"
 * primary) and the web headline copy "Hits your targets N of M days". The
 * verdict DATA stays the shared `computePlanWeekVerdict` — only the rendered
 * string differs, exactly as the canonical prototype differs between its
 * mobile Plan (~L4718) and `WebPlan` (~L7627) headers.
 *
 * Presentational only — the host computes the date label + verdict and owns the
 * generate/adjust/templates handlers.
 */
export interface PlanHeaderV3Props {
  /** Week range, e.g. "16–22 June". Rendered uppercase as the overline. */
  dateRangeLabel: string;
  /** Completeness verdict, or `null` before a plan exists (verdict row hidden). */
  verdict: PlanWeekVerdict | null;
  onGenerate: () => void;
  onAdjust: () => void;
  onTemplates: () => void;
  /** Desktop-dashboard variant: labelled actions + web verdict copy. */
  wide?: boolean;
}

function ActButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-border bg-card shadow-sm text-foreground transition-[background-color,transform] hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
    >
      {children}
    </button>
  );
}

/** Labelled pill for the wide header — outline (secondary) or the ONE filled
 *  primary. Matches the dashboard right-rail button grammar (rounded-full,
 *  13px semibold, hover tint, focus ring). */
function WideButton({
  label,
  onClick,
  primary = false,
  children,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        primary
          ? "inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-[transform,opacity] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]"
          : "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-[background-color] hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]"
      }
    >
      {children}
      {label}
    </button>
  );
}

export function PlanHeaderV3({
  dateRangeLabel,
  verdict,
  onGenerate,
  onAdjust,
  onTemplates,
  wide = false,
}: PlanHeaderV3Props) {
  // Wide (desktop `WebPlan`) renders the prototype's web headline copy from
  // the SAME shared verdict numbers (prototype L7627); compact keeps the
  // shared mobile copy (prototype L4718).
  const headline =
    wide && verdict
      ? `Hits your targets ${verdict.daysHit} of ${verdict.total} days`
      : verdict?.headline;
  return (
    <div className="mb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 shrink">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-foreground-tertiary">
            {dateRangeLabel.toUpperCase()}
          </p>
          <h2 className="mt-0.5 font-[family-name:var(--font-headline)] text-[28px] font-medium leading-tight tracking-tight text-foreground">
            Your plan
          </h2>
        </div>
        {wide ? (
          <div className="flex items-center gap-2">
            <WideButton label="Adjust" onClick={onAdjust}>
              <SlidersHorizontal className="size-[15px]" strokeWidth={1.9} />
            </WideButton>
            <WideButton label="Templates" onClick={onTemplates}>
              <Bookmark className="size-[15px]" strokeWidth={1.9} />
            </WideButton>
            <WideButton label="Generate week" onClick={onGenerate} primary>
              <Sparkles className="size-[15px]" strokeWidth={1.9} />
            </WideButton>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <ActButton label="Generate week" onClick={onGenerate}>
              <Sparkles className="size-[17px]" strokeWidth={1.9} />
            </ActButton>
            <ActButton label="Adjust constraints" onClick={onAdjust}>
              <SlidersHorizontal className="size-[17px]" strokeWidth={1.9} />
            </ActButton>
            <ActButton label="Templates" onClick={onTemplates}>
              <Bookmark className="size-4" strokeWidth={1.9} />
            </ActButton>
          </div>
        )}
      </div>

      {verdict ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{
              backgroundColor:
                verdict.tone === "success"
                  ? "var(--accent-success)"
                  : "var(--warning)",
            }}
          />
          <span className="text-[13px] font-semibold leading-[18px] text-foreground">
            {headline}
          </span>
          {verdict.subline ? (
            <span className="text-[11px] text-foreground-tertiary">
              {verdict.subline}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default PlanHeaderV3;
