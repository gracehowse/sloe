import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

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

/** Within ±15% of target reads as "on track" (matches the prior inline rule). */
const CLOSE_BAND = 0.15;

export function PlanDayMacroSummary({ cells }: PlanDayMacroSummaryProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "stretch",
          gap: Spacing.xs,
          marginBottom: Spacing.sm,
        },
        cell: {
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          paddingVertical: Spacing.sm,
          paddingHorizontal: 4,
          borderRadius: Radius.lg,
          backgroundColor: colors.backgroundSecondary,
        },
        value: {
          fontSize: 13,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        },
        statusRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
        },
        onTrack: {
          fontSize: 10,
          fontWeight: "600",
          color: Accent.success,
          letterSpacing: 0.2,
        },
        gap: {
          fontSize: 11,
          fontWeight: "600",
          color: Accent.warning,
          fontVariant: ["tabular-nums"],
        },
      }),
    [colors.backgroundSecondary],
  );

  return (
    <View style={styles.row} accessibilityRole="summary">
      {cells.map(({ label, value, target, color }) => {
        const diff = value - target;
        const pct = target > 0 ? Math.abs(diff) / target : 0;
        const isClose = pct < CLOSE_BAND;
        const roundedDiff = Math.round(diff);
        const gapLabel = `${roundedDiff > 0 ? `+${roundedDiff}` : `${roundedDiff}`}g`;
        const a11y = isClose
          ? `${label} ${value} grams, on track`
          : `${label} ${value} grams, ${Math.abs(roundedDiff)} ${
              roundedDiff > 0 ? "over" : "under"
            } target`;
        return (
          <View key={label} style={styles.cell} accessibilityLabel={a11y}>
            <Text style={[styles.value, { color }]}>
              {label} {Math.round(value)}g
            </Text>
            {isClose ? (
              <View style={styles.statusRow}>
                <Check size={10} color={Accent.success} strokeWidth={3} />
                <Text style={styles.onTrack}>On track</Text>
              </View>
            ) : (
              <Text style={styles.gap}>{gapLabel}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default PlanDayMacroSummary;
