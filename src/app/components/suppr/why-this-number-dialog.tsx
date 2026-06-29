"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  buildWhyThisNumber,
  type WhyThisNumberInput,
} from "../../../lib/nutrition/whyThisNumber";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { WhyNumberV3Section } from "./WhyNumberV3Section";

/**
 * WhyThisNumberDialog — "Why this number?" tap-to-explain for the
 * Today calorie target (web). Mirrors
 * `apps/mobile/components/today/WhyThisNumberSheet.tsx`.
 *
 * Closes audit gap #10 (transparency moat). Same pure
 * `buildWhyThisNumber` helper backs both surfaces, so a copy or
 * formatting drift fails the shared test (`whyThisNumber.test.ts`).
 */

export interface WhyThisNumberDialogProps extends WhyThisNumberInput {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional CTA — when present, renders an "Adjust target" button at
   *  the bottom that closes the dialog and fires this handler. The host
   *  wires it to the weekly check-in flow. */
  onAdjustTarget?: () => void;
}

export function WhyThisNumberDialog({
  open,
  onOpenChange,
  onAdjustTarget,
  ...input
}: WhyThisNumberDialogProps) {
  const result = buildWhyThisNumber(input);
  const sectionA = isFeatureEnabled("eng1247_section_a_v1");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="why-this-number-dialog"
      >
        <DialogHeader>
          <DialogTitle>Why this number?</DialogTitle>
          <DialogDescription className="sr-only">
            {result.summary}
          </DialogDescription>
        </DialogHeader>

        {sectionA ? (
          <WhyNumberV3Section
            targetCalories={input.targetCalories}
            result={result}
            confidence={input.confidence}
            loggingDays={input.loggingDays}
            onKeepTarget={() => onOpenChange(false)}
            onAdjustTarget={
              onAdjustTarget
                ? () => {
                    onOpenChange(false);
                    onAdjustTarget();
                  }
                : undefined
            }
          />
        ) : (
          <>
        {/* Headline */}
        <div>
          {/* v3 prototype `.whyn-big` — serif (Newsreader) numeral grammar,
              was sans `font-bold`. Size held at the original text-2xl: the
              live headline is one combined string ("Today's target: N kcal"),
              not the prototype's isolated big number, so a hero bump just
              wraps awkwardly. (ENG-1247) */}
          <p
            className="font-[family-name:var(--font-headline)] text-2xl font-semibold tabular-nums -tracking-[0.02em] text-foreground"
            data-testid="why-this-number-target-headline"
          >
            {result.targetHeadline}
          </p>
          {result.isEarlyEstimate ? (
            <p className="text-xs italic text-muted-foreground mt-1">
              Early estimate — keep logging and we&apos;ll calibrate.
            </p>
          ) : result.calibratingAsk ? (
            <p
              data-testid="why-this-number-calibrating-ask"
              className="text-xs text-muted-foreground mt-1 leading-snug"
            >
              {result.calibratingAsk}
            </p>
          ) : null}
        </div>

        {/* 3-row breakdown */}
        <div className="flex flex-col gap-2 mt-2">
          {result.lines.map((line) => (
            <div
              key={line.key}
              data-testid={`why-this-number-line-${line.key}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <span className="text-sm font-semibold text-muted-foreground">
                {line.label}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {line.value}
              </span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {result.summary}
        </p>

        {/* How we work this out — plain-English story of the maintenance
            architecture (2026-06-10 adaptive-TDEE decision). Same beats as
            the mobile sheet via the shared `buildWhyThisNumber` helper, so a
            copy drift fails the shared test. */}
        {result.storyBeats.length > 0 ? (
          <div data-testid="why-this-number-story" className="flex flex-col gap-3">
            <p className="text-[11px] font-extrabold tracking-wider text-muted-foreground">
              HOW WE WORK THIS OUT
            </p>
            <ul className="flex flex-col gap-3">
              {result.storyBeats.map((beat) => (
                <li
                  key={beat.key}
                  data-testid={`why-this-number-beat-${beat.key}`}
                  className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-primary"
                  />
                  <span>{beat.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Adjust target CTA */}
        {onAdjustTarget ? (
          <button
            type="button"
            data-testid="why-this-number-adjust-target"
            onClick={() => {
              onOpenChange(false);
              onAdjustTarget();
            }}
            className="flex items-center justify-between rounded-lg px-4 py-3 bg-primary/15 hover:bg-primary/25 transition-colors"
          >
            <span className="text-sm font-bold text-primary">
              Adjust target
            </span>
            <ChevronRight size={18} strokeWidth={2.25} className="text-primary" />
          </button>
        ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default WhyThisNumberDialog;
