"use client";

import * as React from "react";

import type { PlanDayStatus } from "@/lib/planning/planWeekStatus";

/**
 * PlanWeekStripV3 — Sloe v3 Plan week strip / day selector.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanWeekStripV3.tsx`
 * (prototype `Sloe-App.html` Plan `pweek` ~L4725-4734): a 7-cell row, each cell
 * = day letter + date numeral + a 3-state status ring (full = sage / part =
 * amber / empty = hollow outline) folded into navigation. The selected day
 * fills plum with white text + a white ring; today (when not selected) tints
 * its letter the brand accent.
 *
 * Presentational — the host derives each day's status from the real week plan
 * (`computePlanDayStatus`) and owns the selected-day state. Behind sloe_v3_plan.
 */
export interface PlanWeekStripDay {
  /** Stable key (e.g. the day's ISO date or index). */
  key: string;
  /** Single-letter weekday, e.g. "M". */
  dayLetter: string;
  /** Date numeral, e.g. 16. */
  dateNum: number;
  status: PlanDayStatus;
  isToday: boolean;
}

export interface PlanWeekStripV3Props {
  days: PlanWeekStripDay[];
  selectedKey: string;
  onSelectDay: (key: string) => void;
}

function ringStyle(
  status: PlanDayStatus,
  selected: boolean,
): React.CSSProperties {
  if (selected) {
    return { backgroundColor: "var(--primary-foreground)", borderWidth: 0 };
  }
  if (status === "empty") {
    return {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "var(--border-strong)",
    };
  }
  return {
    backgroundColor:
      status === "full" ? "var(--accent-success)" : "var(--warning)",
    borderWidth: 0,
  };
}

export function PlanWeekStripV3({
  days,
  selectedKey,
  onSelectDay,
}: PlanWeekStripV3Props) {
  return (
    <div className="mt-3 flex gap-1.5" role="tablist">
      {days.map((d) => {
        const selected = d.key === selectedKey;
        return (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={`${d.dayLetter} ${d.dateNum}`}
            onClick={() => onSelectDay(d.key)}
            className="flex flex-1 flex-col items-center gap-[5px] rounded-xl border border-transparent py-2.5 transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 hover:bg-[var(--background-secondary)]"
            style={
              selected ? { backgroundColor: "var(--primary)" } : undefined
            }
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.04em]"
              style={{
                color: selected
                  ? "var(--primary-foreground)"
                  : d.isToday
                    ? "var(--primary)"
                    : "var(--foreground-tertiary)",
              }}
            >
              {d.dayLetter}
            </span>
            <span
              className="text-[15px] font-semibold tabular-nums"
              style={{
                color: selected
                  ? "var(--primary-foreground)"
                  : "var(--foreground)",
              }}
            >
              {d.dateNum}
            </span>
            <span
              aria-hidden
              className="block size-[7px] rounded-full"
              style={ringStyle(d.status, selected)}
            />
          </button>
        );
      })}
    </div>
  );
}

export default PlanWeekStripV3;
