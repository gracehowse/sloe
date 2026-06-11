import * as React from "react";
import { StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { MacroStatPill } from "@/components/nutrition/MacroStatPill";

/**
 * PlanDayMacroSummary — the per-day macro line under each Plan day header.
 *
 * Replaces the cramped inline run `P 0g ⁻¹⁰¹  C 0g ⁻⁶⁸  F 0g ⁻²⁵  Fi 0g ⁻¹⁵`
 * (a dense wall of glyphs that read as clutter and was hard to scan) with
 * four calm, evenly-spread cells — one per macro. Each cell is a soft
 * tinted slab with a clear two-line hierarchy:
 *
 *   - line 1: the macro letter + current grams (coloured to the macro hue)
 *   - line 2: the delta status — a sage check ("on track") when within the
 *     ±15% close band, else a quiet amber `+N` / `−N` gap.
 *
 * Spreading the four cells with `space-between` gives the row breathing
 * room so a week scans top-to-bottom at a glance. Sloe rhythm: cream cells,
 * macro-hue values, calm-not-alarming amber for the gap (never red — over
 * is amber per the carryover rules; this is "near / not near" not "broken").
 *
 * Presentational only — totals + targets are computed in `planner.tsx` and
 * passed in. Extracted (not inline) so the macro row is unit-testable and to
 * keep the oversized `planner.tsx` from growing (CLAUDE.md 400-line bar).
 *
 * Web parity: web renders the same signal as P/C/F delta chips inside each
 * day column of the 7-column grid (`MealPlanner.tsx`). The vertical-stacked
 * mobile layout vs the web grid is a documented intentional divergence
 * (`docs/decisions/2026-04-28-plan-day-summary-strip-web-divergence.md`).
 */

/** A single macro's totals vs target for the day. */
export interface PlanDayMacroCell {
  /** Short macro label — "P" / "C" / "F" / "Fi". */
  label: string;
  /** Current planned grams for the day. */
  value: number;
  /** The day target grams for this macro. */
  target: number;
  /** Macro hue for the value text. */
  color: string;
}

export interface PlanDayMacroSummaryProps {
  cells: readonly PlanDayMacroCell[];
}

export function PlanDayMacroSummary({ cells }: PlanDayMacroSummaryProps) {
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "stretch",
          gap: Spacing.xs,
          marginBottom: Spacing.sm,
        },
      }),
    [],
  );

  return (
    <View style={styles.row} accessibilityRole="summary">
      {cells.map(({ label, value, target, color }) => {
        const diff = value - target;
        const pct = target > 0 ? Math.abs(diff) / target : 0;
        const isClose = pct < 0.15;
        const roundedDiff = Math.round(diff);
        const a11y = isClose
          ? `${label} ${value} grams, on track`
          : `${label} ${value} grams, ${Math.abs(roundedDiff)} ${
              roundedDiff > 0 ? "over" : "under"
            } target`;
        return (
          <MacroStatPill
            key={label}
            label={label}
            current={value}
            target={target}
            color={color}
            variant="delta"
            showProgressFill
            testID={`plan-macro-pill-${label}`}
            accessibilityLabel={a11y}
          />
        );
      })}
    </View>
  );
}

export default PlanDayMacroSummary;
