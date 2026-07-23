import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { CountBadge } from "@/components/ui/CountBadge";
import { SupprRadio } from "@/components/ui/SupprRadio";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { UI_ANATOMY_OWNERS_V1 } from "@/lib/uiAnatomyOwners";
import {
  type PlanSourceMode,
  PLAN_SOURCE_MODES,
  PLAN_SOURCE_ROW_META,
  planSourceCount,
} from "@suppr/shared/planning/planSource";

/**
 * ENG-790 (2026-05-31) — "Plan from" source selector for the Plan tab.
 * ENG-1665: count pills migrate to `CountBadge` when `ui_anatomy_owners_v1`
 * is on; legacy inline badge when off.
 */
export interface PlanSourceSelectorProps {
  mode: PlanSourceMode;
  onChange: (mode: PlanSourceMode) => void;
  libraryCount: number;
  discoverCount: number;
}

export function PlanSourceSelector({
  mode,
  onChange,
  libraryCount,
  discoverCount,
}: PlanSourceSelectorProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const anatomyOwners = isFeatureEnabled(UI_ANATOMY_OWNERS_V1);

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
                selected && { borderColor: colors.tint, backgroundColor: accent.primarySoft },
              ]}
            >
              <SupprRadio checked={selected} accentColor={colors.tint} />
              <View style={styles.textWrap}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {meta.title}
                  </Text>
                  {anatomyOwners ? (
                    <CountBadge count={count} active={selected} testID={`plan-source-count-${m}`} />
                  ) : (
                    <View
                      style={[
                        styles.countBadge,
                        { backgroundColor: selected ? colors.card : colors.border + "80" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.countText,
                          { color: selected ? colors.text : colors.textTertiary },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
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
  textWrap: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  title: { fontSize: 13, fontWeight: "700" },
  countBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  countText: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  subtitle: { fontSize: 11.5, marginTop: Spacing.xs, lineHeight: 16 },
});

export default PlanSourceSelector;
