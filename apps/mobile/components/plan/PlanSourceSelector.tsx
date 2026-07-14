import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { withAlpha, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  type PlanSourceMode,
  PLAN_SOURCE_MODES,
  PLAN_SOURCE_ROW_META,
  planSourceCount,
} from "@suppr/shared/planning/planSource";

/**
 * ENG-790 (2026-05-31) — "Plan from" source selector for the Plan tab,
 * gated behind `plan_source_selector` at the call site
 * (`app/(tabs)/planner.tsx`).
 *
 * Grace's call: "give them the option to generate from the discovery pool …
 * we should probably always give these options — plan from library only,
 * library & discovery, only discovery." Three radio rows let the user choose
 * where a generated plan draws recipes from. Pool-building + the generate
 * gate run off the shared `@suppr/shared/planning/planSource` helper so web
 * and mobile can't silently diverge (web pooled saved-only, mobile pooled
 * saved+discover — this control makes the choice explicit on both).
 *
 * Presentational only — the mode lives as state in `planner.tsx`; this just
 * renders + reports taps. Extracted (not inline) so it is unit-testable and
 * to keep the oversized `planner.tsx` from growing (CLAUDE.md 400-line bar).
 * Web parity: the same three-row control in `src/app/components/MealPlanner.tsx`.
 */
export interface PlanSourceSelectorProps {
  mode: PlanSourceMode;
  onChange: (mode: PlanSourceMode) => void;
  /** Count of recipes the user has saved (the "My library" pool). */
  libraryCount: number;
  /** Count of discover recipes not already in the library (the "Discovery" pool). */
  discoverCount: number;
}

export function PlanSourceSelector({
  mode,
  onChange,
  libraryCount,
  discoverCount,
}: PlanSourceSelectorProps) {
  const colors = useThemeColors();
  return (
    <View testID="plan-source-selector">
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Plan from</Text>
      <View style={styles.rows}>
        {PLAN_SOURCE_MODES.map((m) => {
          const meta = PLAN_SOURCE_ROW_META[m];
          const count = planSourceCount(m, { libraryCount, discoverCount });
          const selected = m === mode;
          const empty = count === 0;
          return (
            <PressableScale
              key={m}
              haptic="selection"
              testID={`plan-source-row-${m}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${meta.title}, ${count} recipe${count === 1 ? "" : "s"}`}
              onPress={() => onChange(m)}
              style={[
                styles.row,
                { borderColor: colors.border, backgroundColor: colors.card },
                selected && { borderColor: colors.tint, backgroundColor: withAlpha(colors.tint, 0x1A) },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: selected ? colors.tint : colors.textTertiary },
                ]}
              >
                {selected ? <View style={[styles.radioDot, { backgroundColor: colors.tint }]} /> : null}
              </View>
              <View style={styles.textWrap}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {meta.title}
                  </Text>
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: selected ? colors.card : withAlpha(colors.border, 0x80) },
                    ]}
                  >
                    <Text
                      style={[styles.countText, { color: selected ? colors.text : colors.textTertiary }]}
                    >
                      {count}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {empty ? meta.emptySubtitle : meta.subtitle}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // headers census 2026-06-10: section eyebrow → Type.label (kills 10.5px half-pixel).
  sectionLabel: {
    ...Type.label,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rows: { gap: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
    paddingVertical: Spacing.dense,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: Radius.full,
    borderWidth: 1.8,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  textWrap: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  title: { fontSize: 13, fontWeight: "700" },
  countBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  countText: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  subtitle: { fontSize: 11.5, marginTop: Spacing.xs, lineHeight: 16 },
});

export default PlanSourceSelector;
