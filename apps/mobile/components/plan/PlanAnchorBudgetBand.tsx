import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  planDayDistributeAroundAnchor,
  type PlanDayMealLike,
} from "@suppr/nutrition-core/distributeAroundAnchor";
import type { MacroTargets } from "@suppr/nutrition-core/remainingMacros";

/**
 * ENG-855 / make-anything-fit Mode B — distribute-around-anchor band (mobile).
 *
 * Renders the Plan-tab "if I commit to this meal, here's how the rest of the
 * day shakes out" band beneath a day card. ALL distribution math + body-neutral
 * copy lives in `@suppr/nutrition-core/distributeAroundAnchor` — this component
 * is presentational only, so the screen-budget-PINNED `planner.tsx` host stays
 * net-neutral (one import + one `<PlanAnchorBudgetBand />` call site).
 *
 * Gated by `plan_distribute_anchor_v1` (DEFAULT-ON, ENG-1279) at the host. The
 * web twin is `src/app/components/suppr/plan-anchor-budget-band.tsx`; the two
 * read the SAME shared result/copy so they can't drift.
 *
 * Trust posture: the qualitative branch (low-confidence anchor) shows the
 * "roughly how the rest of the day shakes out" line with NO per-slot numbers —
 * the nutrition-trust rule, end to end. `tooTight` slots render their honest
 * "barely room" state rather than a fabricated tiny number.
 */

export interface PlanAnchorBudgetBandProps {
  /** Flag gate (`plan_distribute_anchor_v1`) — false → render nothing. */
  enabled: boolean;
  /** This plan day's meals (placed + placeholders), in slot order. */
  meals: readonly PlanDayMealLike[];
  /** The day's macro targets, or null when the user has no targets yet. */
  targets: MacroTargets | null;
}

export function PlanAnchorBudgetBand({ enabled, meals, targets }: PlanAnchorBudgetBandProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        band: {
          marginTop: Spacing.sm,
          borderRadius: Radius.lg,
          backgroundColor: colors.backgroundSecondary,
          padding: Spacing.dense,
        },
        copy: {
          ...Type.bodyMuted,
          color: colors.textSecondary,
        },
        chipRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Spacing.xs,
          marginTop: Spacing.sm,
        },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.xs,
          backgroundColor: colors.card,
          borderRadius: Radius.full,
          paddingHorizontal: Spacing.dense,
          paddingVertical: Spacing.xs,
        },
        chipSlot: {
          ...Type.caption,
          color: colors.textSecondary,
          fontWeight: "600",
        },
        chipValue: {
          ...Type.caption,
          color: colors.textTertiary,
          fontVariant: ["tabular-nums"],
        },
      }),
    [colors],
  );

  // Derivation + math + copy live in the shared selector so the pinned host
  // stays net-neutral. Null unless this day has a locked anchor + an open slot,
  // the flag is on, and targets exist.
  const distribution = enabled && targets ? planDayDistributeAroundAnchor(meals, targets) : null;

  // Nothing to plan around (no locked anchor / no open slots) → render nothing.
  if (!distribution || !distribution.copy) return null;
  const { result, copy } = distribution;

  const showSlots = result.kind === "distributed" && !result.anchorLeavesTooLittle;

  return (
    <View style={styles.band} testID="plan-anchor-budget-band">
      <Text style={styles.copy}>{copy}</Text>
      {showSlots ? (
        <View style={styles.chipRow}>
          {result.slots
            // Optional slots (Snacks) keep their budget for suggestion-scoping
            // but are never shown as a named aim — mirrors emptySlotAimKcal.
            .filter((s) => !s.optional)
            .map((s) => (
              <View key={s.slot} style={styles.chip} testID={`plan-anchor-slot-${s.slot}`}>
                <Text style={styles.chipSlot}>{s.slot}</Text>
                {s.tooTight ? (
                  <Text style={styles.chipValue} testID={`plan-anchor-slot-tight-${s.slot}`}>
                    barely room
                  </Text>
                ) : (
                  <Text style={styles.chipValue}>{`~${s.calories.toLocaleString()} kcal`}</Text>
                )}
              </View>
            ))}
        </View>
      ) : null}
    </View>
  );
}

export default PlanAnchorBudgetBand;
