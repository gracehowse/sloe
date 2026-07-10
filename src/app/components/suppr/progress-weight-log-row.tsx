"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { SupprButton } from "./suppr-button.tsx";

/**
 * ProgressWeightLogRow — the weight card's inline log affordance: the quick
 * number input + the QUIET "Log weight" button (v3 prototype: the app's
 * `ghost` = the retired bordered-secondary, not a filled primary — the chart
 * stays the card's hero, ENG-1247) + the Gap-13 editorial coaching line
 * (Newsreader italic 14px, matches the mobile Type.coach register; web mirror
 * of `weight-tracker.tsx` 2026-06-09).
 *
 * Extracted from `ProgressDashboard` (ENG-1504) so the sparse/empty weight
 * state can hide this row until its in-frame CTA reveals it — the empty card
 * shows exactly ONE log-weigh-in affordance (ENG-1372 law 2) — without
 * growing that pinned host.
 */
export function ProgressWeightLogRow({
  inputRef,
  value,
  onChange,
  isImperial,
  onSave,
}: {
  inputRef: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  isImperial: boolean;
  onSave: () => void;
}) {
  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          placeholder={isImperial ? "Weight (lb)" : "Weight (kg)"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="number"
          step="0.1"
          aria-label="Log weight"
        />
        <SupprButton
          variant="ghost"
          onClick={onSave}
          data-testid="progress-log-weight"
          aria-label="Log weight"
        >
          <Icons.add className="h-4 w-4" aria-hidden />
          Log weight
        </SupprButton>
      </div>
      <p
        data-testid="weight-input-supportive-copy"
        className="mt-1.5 text-center text-[13px] italic text-muted-foreground font-[family-name:var(--font-headline)]"
      >
        Every check-in gives us better data for you.
      </p>
    </>
  );
}

export default ProgressWeightLogRow;
