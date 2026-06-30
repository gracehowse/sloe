"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { SupprButton } from "./suppr-button";
import type { WeeklyCheckinContent } from "../../../lib/nutrition/weeklyCheckin";

/**
 * WeeklyCheckinDialog — web parity for the mobile WeeklyCheckinModal
 * (PR claude/weekly-checkin-ritual-v2, 2026-05-02 — rebuild of #26).
 *
 * Surfaces the adaptive-vs-formula TDEE delta + the suggested new
 * daily target. Soft prompt — every dismiss path persists the
 * decision via the host's `onDismiss` handler.
 *
 * Pure presentation; gating + content build live in
 * `src/lib/nutrition/weeklyCheckin.ts`.
 */
export interface WeeklyCheckinDialogProps {
  open: boolean;
  /** `null` is a programming error — only mount when content is built. */
  content: WeeklyCheckinContent | null;
  /** Current daily calorie target — used for the "from" comparator. */
  currentTargetKcal: number;
  /** "Accept new target" — host updates `target_calories` to
   *  `content.suggestedTargetKcal` and persists the decision. */
  onAccept: () => void;
  /** "Keep current" — host persists the decision but leaves target
   *  alone. Also fires from the close X and Escape. */
  onDismiss: () => void;
}

export function WeeklyCheckinDialog({
  open,
  content,
  currentTargetKcal,
  onAccept,
  onDismiss,
}: WeeklyCheckinDialogProps) {
  if (!content) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-center">
            {content.headline}
          </DialogTitle>
          <DialogDescription className="text-sm text-center text-muted-foreground px-2">
            {content.whyLine}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border px-4 py-3 mt-1 space-y-2">
          <Row label="Avg logged daily" value={content.avgThisWeekLabel} />
          {content.weightDeltaLabel ? (
            <Row label="Weight delta" value={content.weightDeltaLabel} />
          ) : null}
          {content.tdeeDeltaKcal != null ? (
            <Row
              label="TDEE delta"
              value={
                content.tdeeDeltaKcal === 0
                  ? "0 kcal"
                  : `${content.tdeeDeltaKcal > 0 ? "+" : "−"}${Math.abs(
                      content.tdeeDeltaKcal,
                    )} kcal`
              }
            />
          ) : null}
        </div>

        <div
          className="rounded-xl px-4 py-3 mt-3"
          style={{
            backgroundColor: "rgba(var(--primary-rgb, 76 108 224) / 0.08)",
            borderColor: "rgba(var(--primary-rgb, 76 108 224) / 0.35)",
            borderWidth: 1,
            borderStyle: "solid",
          }}
        >
          <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Suggested daily target
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className="text-sm text-muted-foreground line-through"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(currentTargetKcal).toLocaleString("en-GB")}
            </span>
            {/* SLOE Phase 0: the suggested-target hero numeral reads in the
                Newsreader serif display face; the struck-out prior value +
                `kcal/day` unit stay sans. Mirrors mobile WeeklyCheckinModal. */}
            <span
              className="font-[family-name:var(--font-headline)] text-2xl font-medium text-primary-solid"
              style={{ fontVariantNumeric: "tabular-nums" }}
              aria-label={`Suggested ${content.suggestedTargetKcal} kilocalories per day`}
            >
              {content.suggestedTargetKcal.toLocaleString("en-GB")}
            </span>
            <span
              className="text-sm text-muted-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              kcal/day
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {/* Sloe button system (2026-06-12): main CTA → SupprButton
              variant="primary" (solid aubergine pill); the "Keep current"
              tertiary → variant="ghost" (transparent / plum label). Mirror
              of mobile `WeeklyCheckinModal`. */}
          <SupprButton
            variant="primary"
            type="button"
            onClick={onAccept}
            aria-label="Accept new target"
            className="w-full py-3"
          >
            Accept new target
          </SupprButton>
          <SupprButton
            variant="ghost"
            type="button"
            onClick={onDismiss}
            aria-label="Keep current target"
            className="w-full py-3"
          >
            Keep current
          </SupprButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className="font-semibold text-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}

export default WeeklyCheckinDialog;
