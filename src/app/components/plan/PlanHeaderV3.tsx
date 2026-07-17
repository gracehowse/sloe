"use client";

import * as React from "react";
import { Bookmark, Sparkles, SlidersHorizontal } from "lucide-react";

import type { PlanWeekVerdict } from "@/lib/planning/planWeekStatus";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { cn } from "../ui/utils";

/**
 * PlanHeaderV3 — the Sloe v3 Plan header + week-verdict row.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanHeaderV3.tsx` (prototype
 * `docs/ux/redesign/v3/Sloe-App.html` Plan screen ~L4707–4721): the date-range
 * overline + "Your plan" serif title with three quiet round action buttons
 * (generate / adjust / templates), then a verdict row — a tone dot +
 * "On track — N of M days on target" headline + "{M−N} days need a meal or swap"
 * nudge. The verdict comes from {@link PlanWeekVerdict} (`computePlanWeekVerdict`),
 * so completeness logic stays shared web↔mobile.
 *
 * Presentational only — the host computes the date label + verdict and owns the
 * generate/adjust/templates handlers. Behind the `sloe_v3_plan` flag (host-gated).
 */
export interface PlanHeaderV3Props {
  /** Week range, e.g. "16–22 June". Rendered uppercase as the overline. */
  dateRangeLabel: string;
  /** Completeness verdict, or `null` before a plan exists (verdict row hidden). */
  verdict: PlanWeekVerdict | null;
  onGenerate: () => void;
  onAdjust: () => void;
  onTemplates: () => void;
}

function ActButton({
  label,
  onClick,
  consistencyChrome,
  children,
}: {
  label: string;
  onClick: () => void;
  consistencyChrome: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex items-center justify-center text-foreground transition-[background-color,transform] hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95",
        consistencyChrome
          ? "h-10 w-10 rounded-full bg-muted"
          : "h-[38px] w-[38px] rounded-xl border border-border bg-card shadow-sm",
      )}
    >
      {children}
    </button>
  );
}

export function PlanHeaderV3({
  dateRangeLabel,
  verdict,
  onGenerate,
  onAdjust,
  onTemplates,
}: PlanHeaderV3Props) {
  const consistencyChrome = isFeatureEnabled("primary_screen_chrome_v1");
  return (
    <div className="mb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 shrink">
          <p className={cn(
            "text-[11px] uppercase text-foreground-tertiary",
            consistencyChrome ? "font-bold tracking-[0.1em]" : "font-semibold tracking-[0.05em]",
          )}>
            {dateRangeLabel.toUpperCase()}
          </p>
          <h2 className={cn(
            "mt-0.5 text-foreground",
            consistencyChrome
              ? "page-title"
              : "font-[family-name:var(--font-headline)] text-[28px] font-medium leading-tight tracking-tight",
          )}>
            Your plan
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <ActButton label="Generate week" onClick={onGenerate} consistencyChrome={consistencyChrome}>
            <Sparkles className="size-[17px]" strokeWidth={1.9} />
          </ActButton>
          <ActButton label="Adjust constraints" onClick={onAdjust} consistencyChrome={consistencyChrome}>
            <SlidersHorizontal className="size-[17px]" strokeWidth={1.9} />
          </ActButton>
          <ActButton label="Templates" onClick={onTemplates} consistencyChrome={consistencyChrome}>
            <Bookmark className="size-4" strokeWidth={1.9} />
          </ActButton>
        </div>
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
                  : verdict.tone === "warning"
                    ? "var(--warning)"
                    : "var(--foreground-tertiary)",
            }}
          />
          <span className="text-[13px] font-semibold leading-[18px] text-foreground">
            {verdict.headline}
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
