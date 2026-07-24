"use client";

import * as React from "react";

import { isFeatureEnabled } from "@/lib/analytics/track";
import type { PlanDayStatus } from "@/lib/planning/planWeekStatus";

/**
 * PlanWeekStripV3 — Sloe v3 Plan week strip / day selector.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanWeekStripV3.tsx`
 * (prototype `Sloe-App.html` Plan `pweek` ~L4725-4734): a 7-cell row, each cell
 * = day letter + date numeral + a 3-state status ring (full = sage / part =
 * amber / empty = hollow outline) folded into navigation. The status ring keeps
 * its real colour whatever the selection state; today (when not selected) tints
 * its letter the brand accent.
 *
 * ## Selection is a soft plum DISC (`design_consistency_v1`, 2026-07-24)
 * The selected day's numeral sits inside a circular `bg-primary-soft-strong`
 * disc with NO border — the same treatment Today's `DayStrip` uses, so the
 * product's two week strips finally say "selected" the same way.
 *
 * Why a disc, and not the hairline rounded rectangle the day-strip convergence
 * briefly reached for: a 1px grey rounded-rect around a number reads as a
 * focused text input or a spreadsheet cell — an affordance, not a state — and
 * carries no brand colour at all. Circular is this app's signature geometry
 * (the hero ring, the avatar chip, the FAB, the macro dots), and the tint says
 * "selected" in plum rather than in border-grey. Filled rather than stroked, so
 * selecting a day can never shift layout. SoftStrong (20%) rather than Soft
 * (12%): at 12% over the Warm Oat ground the disc desaturates to a grey smudge
 * and reads as chrome instead of as a plum state.
 *
 * ## The flag is a real kill switch
 * With `design_consistency_v1` OFF this reproduces the treatment that actually
 * shipped before the pass — the whole cell floods plum with an inverted white
 * letter / numeral / status ring — rather than the selection-less strip the
 * consistency pass briefly left behind (a kill switch that lands you somewhere
 * the product has never been is not a kill switch).
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
  /** LEGACY ONLY (flag OFF): the plum-filled cell inverted its status ring to
   *  white so it stayed visible against the fill. Always `false` under
   *  `design_consistency_v1`, where the disc sits behind the numeral and the
   *  ring keeps its real status colour. */
  invert: boolean,
): React.CSSProperties {
  if (invert) {
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
  // design_consistency_v1 — the soft plum selection disc, shared with Today's
  // `DayStrip`. OFF reproduces the pre-pass plum-filled cell verbatim.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  return (
    <div className="mt-4 flex gap-1.5" role="tablist">
      {days.map((d) => {
        const selected = d.key === selectedKey;
        // LEGACY ONLY: the whole cell floods plum and every glyph inverts.
        const legacyFill = !unifiedChrome && selected;
        return (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={`${d.dayLetter} ${d.dateNum}`}
            onClick={() => onSelectDay(d.key)}
            className="flex flex-1 flex-col items-center gap-[5px] rounded-xl border border-transparent py-2.5 transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 hover:bg-[var(--background-secondary)]"
            style={legacyFill ? { backgroundColor: "var(--primary)" } : undefined}
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.04em]"
              style={{
                color: legacyFill
                  ? "var(--primary-foreground)"
                  : d.isToday
                    ? "var(--primary)"
                    : "var(--foreground-tertiary)",
              }}
            >
              {d.dayLetter}
            </span>
            {/* min-w-6 (not 7): flex items default to min-width:auto, so a 28px
                floor on all seven cells overflows the strip at mobile-web
                widths and clips Sunday. 24px floor + the h-7 circle keeps the
                disc round enough to read while the week still fits. Mirror of
                web `DayStrip`'s numeral box. */}
            <span
              data-testid={
                unifiedChrome && selected
                  ? "planweekstrip-selected-disc"
                  : undefined
              }
              className={`flex items-center justify-center ${
                unifiedChrome
                  ? `min-w-6 h-7 rounded-full ${
                      selected ? "bg-primary-soft-strong" : ""
                    }`
                  : ""
              }`}
            >
              <span
                className={`text-[15px] font-semibold tabular-nums ${
                  legacyFill ? "" : "text-foreground"
                }`}
                style={
                  legacyFill ? { color: "var(--primary-foreground)" } : undefined
                }
              >
                {d.dateNum}
              </span>
            </span>
            <span
              aria-hidden
              className="block size-[7px] rounded-full"
              style={ringStyle(d.status, legacyFill)}
            />
          </button>
        );
      })}
    </div>
  );
}

export default PlanWeekStripV3;
