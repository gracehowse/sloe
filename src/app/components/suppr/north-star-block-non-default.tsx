"use client";

/**
 * The five non-`default` `<NorthStarBlock>` state branches, extracted so
 * `north-star-block.tsx` stays under its screen-line-budget pin (mirrors the
 * existing `NorthStarFigmaHeroBlock` extraction for the `default` branch).
 * Presentation-only; `NorthStarBlock` decides which branch to render.
 */

import { ChevronRight, Sparkles } from "lucide-react";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { resolveOverBudgetCaption, type OverBudgetStage } from "../../../lib/nutrition/coachOverBudgetStage.ts";
import { SupprCard } from "../ui/suppr-card";
import { SupprNotice } from "../ui/suppr-notice";
import { cn } from "../ui/utils";
import type { NorthStarKind } from "./north-star-block";

export function NorthStarBlockNonDefault({
  kind,
  testID,
  overBudgetStage: stage,
  overBudgetCalories,
  underEatingLine,
  onOpenLibrary,
  onBrowse,
}: {
  kind: Exclude<NorthStarKind, "default">;
  testID?: string;
  overBudgetStage?: OverBudgetStage;
  overBudgetCalories?: { consumed: number; goal: number };
  underEatingLine?: string;
  onOpenLibrary?: () => void;
  onBrowse?: () => void;
}) {
  if (kind === "over-budget") {
    return (
      <div data-slot="north-star-over-budget" data-testid={testID} className="px-1 py-2">
        <p className="text-[13px] text-muted-foreground">
          {resolveOverBudgetCaption(isFeatureEnabled("coaching_stages_v1"), stage, overBudgetCalories)}
        </p>
      </div>
    );
  }

  if (kind === "under-eating") {
    if (!underEatingLine) return null;
    return (
      <div data-slot="north-star-under-eating" data-testid={testID} className="px-1 py-2">
        <p className="text-[13px] text-muted-foreground">{underEatingLine}</p>
      </div>
    );
  }

  if (kind === "new-user") {
    const copy =
      "Log your first meal — suggestions get smarter once we've seen you eat.";
    if (isFeatureEnabled("ui_anatomy_owners_v1")) {
      return (
        <SupprNotice
          tone="primary"
          variant="block"
          data-slot="north-star-new-user"
          data-testid={testID}
          leading={
            <Sparkles aria-hidden width={18} height={18} className="shrink-0 text-primary-solid" />
          }
        >
          <p className="text-[13px] font-semibold">{copy}</p>
        </SupprNotice>
      );
    }
    return (
      <SupprCard
        elevation="card"
        data-slot="north-star-new-user"
        data-testid={testID}
        tone="primary"
        gradient
        padding="md"
        className="flex flex-row items-center gap-3"
      >
        <Sparkles aria-hidden width={18} height={18} className="text-primary shrink-0" />
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-[13px] font-semibold">{copy}</p>
        </div>
      </SupprCard>
    );
  }

  if (kind === "library-empty") {
    // ENG-1662 — SupprNotice under `ui_anatomy_owners_v1` (radius 24 quiet
    // fill). Flag-off keeps the legacy radius-8 hand-rolled row.
    if (isFeatureEnabled("ui_anatomy_owners_v1")) {
      return (
        <SupprNotice
          tone="primary"
          variant="block"
          data-slot="north-star-library-empty"
          data-testid={testID}
          role="button"
          tabIndex={0}
          onClick={onOpenLibrary}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onOpenLibrary?.();
          }}
          aria-label="Pick recipes for your library"
          className="cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
          leading={
            <Sparkles aria-hidden width={18} height={18} className="shrink-0 text-primary-solid" />
          }
        >
          <span className="flex items-center gap-3">
            <span className="flex-1 text-[13px] text-foreground-secondary">
              Pick a few recipes — we&apos;ll suggest from there.
            </span>
            <ChevronRight
              aria-hidden
              width={18}
              height={18}
              className="shrink-0 text-foreground-secondary"
            />
          </span>
        </SupprNotice>
      );
    }
    // ENG-1198: parity with mobile's flattened inset-row grammar. Whole row
    // is the tap target; sparkle → primary-solid, chevron → secondary.
    return (
      <button
        type="button"
        data-slot="north-star-library-empty"
        data-testid={testID}
        onClick={onOpenLibrary}
        aria-label="Pick recipes for your library"
        className={cn(
          "flex w-full flex-row items-center gap-3 rounded-lg bg-fill-quiet px-3 py-3 text-left",
          "transition-opacity hover:opacity-80 active:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        )}
      >
        <Sparkles aria-hidden width={18} height={18} className="shrink-0 text-primary-solid" />
        <span className="flex-1 text-[13px] text-foreground-secondary">
          Pick a few recipes — we'll suggest from there.
        </span>
        <ChevronRight aria-hidden width={18} height={18} className="shrink-0 text-foreground-secondary" />
      </button>
    );
  }

  // kind === "no-fit"
  const noFitBody = (
    <>
      <p className="flex-1 text-[13px] text-muted-foreground">
        Library has nothing under your remaining macros today.
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="shrink-0 text-[11px] font-semibold text-primary-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
      >
        Browse →
      </button>
    </>
  );
  if (isFeatureEnabled("ui_anatomy_owners_v1")) {
    return (
      <SupprNotice
        tone="neutral"
        variant="block"
        data-slot="north-star-no-fit"
        data-testid={testID}
      >
        <div className="flex flex-row items-center gap-3">{noFitBody}</div>
      </SupprNotice>
    );
  }
  return (
    <SupprCard
      elevation="card"
      data-slot="north-star-no-fit"
      data-testid={testID}
      tone="neutral"
      padding="md"
      className="flex flex-row items-center gap-3"
    >
      {noFitBody}
    </SupprCard>
  );
}

export default NorthStarBlockNonDefault;
