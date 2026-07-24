"use client";

import * as React from "react";
import { Bookmark, Sparkles, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PlanWeekVerdict } from "@/lib/planning/planWeekStatus";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { IconButton } from "../ui/icon-button";
import { cn } from "../ui/utils";

/**
 * PlanHeaderV3 — the Sloe v3 Plan header + week-verdict row.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanHeaderV3.tsx` (prototype
 * `docs/ux/redesign/v3/Sloe-App.html` Plan screen ~L4707–4721): the date-range
 * overline + "Your plan" serif title with quiet round action buttons
 * (generate / adjust / templates), then a verdict row — a tone dot +
 * "On track — N of M days on target" headline + "{M−N} days need a meal or swap"
 * nudge. The verdict comes from {@link PlanWeekVerdict} (`computePlanWeekVerdict`),
 * so completeness logic stays shared web↔mobile.
 *
 * Design-consistency pass (2026-07-24), behind `design_consistency_v1`:
 *   - the overline becomes the canonical eyebrow (11/600/0.12em FULL ink,
 *     shared with `ScreenChrome` / the Today hero) instead of its own
 *     tertiary 0.05em fork;
 *   - the three hand-rolled action buttons become the shared `IconButton`
 *     40px muted chip, so Plan stops being the one surface with white
 *     rounded-square card buttons;
 *   - `showGenerate` retires the Sparkles chip while the empty-week card is
 *     up — that card's own "Generate this week" owns the action, and two
 *     controls firing one handler is redundancy, not affordance.
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
  /** Show the Sparkles generate chip. Hosts pass `false` while the empty-week
   *  card is showing — it already carries "Generate this week" as its one
   *  filled CTA. Defaults to `true` (a populated week has no other generate
   *  affordance). */
  showGenerate?: boolean;
}

/** Legacy (kill-switch) button chassis — the white rounded-square card fork
 *  and its `primary_screen_chrome_v1` circular variant. Retired visually by
 *  `design_consistency_v1`, kept alive so the flag can roll back. */
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

function HeaderAction({
  label,
  icon: Icon,
  glyph,
  onClick,
  unifiedChrome,
  consistencyChrome,
}: {
  label: string;
  icon: LucideIcon;
  /** Legacy glyph size class — the unified path uses the primitive's 16px. */
  glyph: string;
  onClick: () => void;
  unifiedChrome: boolean;
  consistencyChrome: boolean;
}) {
  if (unifiedChrome) {
    return (
      <IconButton
        icon={Icon}
        size="lg"
        variant="muted"
        aria-label={label}
        onClick={onClick}
        iconStrokeWidth={1.9}
        className="transition-[transform,opacity] hover:opacity-80"
      />
    );
  }
  return (
    <ActButton label={label} onClick={onClick} consistencyChrome={consistencyChrome}>
      <Icon className={glyph} strokeWidth={1.9} />
    </ActButton>
  );
}

export function PlanHeaderV3({
  dateRangeLabel,
  verdict,
  onGenerate,
  onAdjust,
  onTemplates,
  showGenerate = true,
}: PlanHeaderV3Props) {
  const consistencyChrome = isFeatureEnabled("primary_screen_chrome_v1");
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  return (
    <div className="mb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 shrink">
          {/* The canonical eyebrow. No hairline rule here (unlike ScreenChrome):
              the action chips sit on this optical line and the rule would run
              straight into them — same call as mobile PlanHeaderV3. */}
          <p
            className={cn(
              "text-[11px] uppercase",
              unifiedChrome
                ? "font-semibold tracking-[0.12em] text-foreground"
                : consistencyChrome
                  ? "font-bold tracking-[0.1em] text-foreground-tertiary"
                  : "font-semibold tracking-[0.05em] text-foreground-tertiary",
            )}
          >
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
          {showGenerate ? (
            <HeaderAction
              label="Generate week"
              icon={Sparkles}
              glyph="size-[17px]"
              onClick={onGenerate}
              unifiedChrome={unifiedChrome}
              consistencyChrome={consistencyChrome}
            />
          ) : null}
          <HeaderAction
            label="Adjust constraints"
            icon={SlidersHorizontal}
            glyph="size-[17px]"
            onClick={onAdjust}
            unifiedChrome={unifiedChrome}
            consistencyChrome={consistencyChrome}
          />
          <HeaderAction
            label="Templates"
            icon={Bookmark}
            glyph="size-4"
            onClick={onTemplates}
            unifiedChrome={unifiedChrome}
            consistencyChrome={consistencyChrome}
          />
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
