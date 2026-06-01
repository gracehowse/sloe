import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  computeRemaining,
  projectRemaining,
  type MacroConsumed,
  type MacroTargets,
  type RemainingMacros,
} from "@suppr/shared/nutrition/remainingMacros";

/**
 * RemainingMacrosBar (mobile) — parity with
 * `src/app/components/suppr/remaining-macros-bar.tsx`. Shows a row of
 * 4 columns (KCAL / P / C / F) — or 5 when the user has a fiber target
 * — with how much of each macro is left today.
 *
 * Over-budget macros render in destructive colour with a `+N over` value
 * instead of "left". No red flash on calorie-only over — callers that
 * want to suppress over-calorie shame in "consumed" mode can pass
 * consumed values that stay within budget, or simply rely on the
 * factual copy ("over" vs "left").
 */

export interface RemainingMacrosBarProps {
  targets: MacroTargets;
  consumed: MacroConsumed;
  /** Optional fit-this-in projection. Renders an "after" sub-row when present. */
  candidate?: MacroConsumed | null;
  style?: ViewStyle;
}

type Column = {
  key: "calories" | "protein" | "carbs" | "fat" | "fiber";
  label: string;
  color: string;
  unit: "kcal" | "g";
};

const BASE_COLUMNS: Column[] = [
  { key: "calories", label: "KCAL", color: MacroColors.calories, unit: "kcal" },
  { key: "protein", label: "PROTEIN", color: MacroColors.protein, unit: "g" },
  { key: "carbs", label: "CARBS", color: MacroColors.carbs, unit: "g" },
  { key: "fat", label: "FAT", color: MacroColors.fat, unit: "g" },
];

const FIBER_COLUMN: Column = {
  key: "fiber",
  label: "FIBER",
  color: MacroColors.fiber,
  unit: "g",
};

const ARIA_LABEL: Record<Column["key"], string> = {
  calories: "calories",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  fiber: "fiber",
};

function valueFor(r: RemainingMacros, key: Column["key"]): number | undefined {
  if (key === "fiber") return r.fiber;
  return r[key];
}

function deltaFor(r: RemainingMacros, key: Column["key"]): number | undefined {
  return r.deltas[key];
}

function overFor(r: RemainingMacros, key: Column["key"]): boolean {
  switch (key) {
    case "calories": return r.overCalories;
    case "protein": return r.overProtein;
    case "carbs": return r.overCarbs;
    case "fat": return r.overFat;
    case "fiber": return r.overFiber;
  }
}

function targetFor(t: MacroTargets, key: Column["key"]): number {
  if (key === "fiber") return Math.max(0, Math.round(t.fiber ?? 0));
  return Math.max(0, Math.round(t[key]));
}

export function RemainingMacrosBar({
  targets,
  consumed,
  candidate = null,
  style,
}: RemainingMacrosBarProps) {
  const colors = useThemeColors();
  const cardElevation = useCardElevation();
  const current = React.useMemo(() => computeRemaining(targets, consumed), [targets, consumed]);
  const projected = React.useMemo(
    () => (candidate ? projectRemaining(targets, consumed, candidate) : null),
    [targets, consumed, candidate],
  );

  const includeFiber = typeof current.fiber === "number";
  const columns = includeFiber ? [...BASE_COLUMNS, FIBER_COLUMN] : BASE_COLUMNS;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Remaining daily macros"
      style={[
        styles.container,
        {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderColor: colors.cardBorder,
          borderWidth: cardElevation.useBorder ? 1 : 0,
        },
        cardElevation.shadowStyle,
        style,
      ]}
    >
      {columns.map((col) => {
        const remaining = valueFor(current, col.key);
        const delta = deltaFor(current, col.key);
        const over = overFor(current, col.key);
        const display = over && delta != null ? `+${Math.abs(delta)}` : `${remaining ?? 0}`;
        const target = targetFor(targets, col.key);
        const suffix = over ? "over" : "left";
        const ariaLabel = over
          ? `${Math.abs(delta ?? 0)} ${col.unit === "kcal" ? "kilocalories" : `grams of ${ARIA_LABEL[col.key]}`} over today's target`
          : `${remaining ?? 0} ${col.unit === "kcal" ? "kilocalories" : `grams of ${ARIA_LABEL[col.key]}`} remaining`;

        let pDisplay: string | null = null;
        let pSuffix = "";
        let pOver = false;
        let pAria = "";
        if (projected) {
          const pRem = valueFor(projected, col.key);
          const pDelta = deltaFor(projected, col.key);
          pOver = overFor(projected, col.key);
          pDisplay = pOver && pDelta != null ? `+${Math.abs(pDelta)}` : `${pRem ?? 0}`;
          pSuffix = pOver ? "over" : "left";
          pAria = pOver
            ? `After logging this, ${Math.abs(pDelta ?? 0)} ${col.unit === "kcal" ? "kilocalories" : `grams of ${ARIA_LABEL[col.key]}`} over`
            : `After logging this, ${pRem ?? 0} ${col.unit === "kcal" ? "kilocalories" : `grams of ${ARIA_LABEL[col.key]}`} remaining`;
        }

        return (
          <View
            key={col.key}
            style={styles.col}
            accessibilityLabel={ariaLabel}
            accessible
          >
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: col.color }]} />
              <Text style={[styles.label, { color: colors.textTertiary }]}>{col.label}</Text>
            </View>
            <Text
              style={[
                styles.value,
                { color: over ? Accent.warning : colors.text },
              ]}
            >
              {display}
              {col.unit === "g" ? <Text style={styles.unit}>g</Text> : null}
            </Text>
            <Text style={[styles.subLabel, { color: colors.textTertiary }]}>
              {suffix} · /{target}
              {col.unit === "g" ? "g" : ""}
            </Text>
            {projected && pDisplay != null ? (
              <View
                style={[styles.afterRow, { borderTopColor: colors.border }]}
                accessibilityLabel={pAria}
              >
                <Text style={[styles.afterTag, { color: colors.textTertiary }]}>after</Text>
                <Text
                  style={[
                    styles.afterValue,
                    { color: pOver ? Accent.warning : colors.text },
                  ]}
                >
                  {pDisplay}
                  {col.unit === "g" ? "g" : ""}
                </Text>
                <Text style={[styles.afterSuffix, { color: colors.textTertiary }]}>{pSuffix}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.sm,
    // Audit M6 (2026-04-18): card-shell uses Radius.lg to match the rest
    // of the Today cards (mobile convention, matches web `rounded-card`).
    // Border + elevation are applied at render via `useCardElevation()`
    // (ENG-795 flag-gated soft elevation) so they react to the flag/theme.
    borderRadius: Radius.lg,
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    lineHeight: 20,
  },
  unit: {
    fontSize: 10,
    fontWeight: "700",
  },
  subLabel: {
    fontSize: 10,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  afterRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  afterTag: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  afterValue: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  afterSuffix: {
    fontSize: 9,
  },
});
