import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  dailyValuePercent,
  isLimitNutrient,
} from "../../../../src/lib/nutrition/dailyValues";

/**
 * TodayMicrosWidget — 4 horizontal-scroll micronutrient tiles for Today.
 *
 * Closes audit gap #1 (Cronometer-grade micros). Suppr already logs 35+
 * micronutrients via `sumMicrosFromLoggedMeals`; this widget surfaces the
 * 4 most diet-relevant ones (fibre intake, iron, vitamin D status,
 * sodium budget) so the macro-only persona switching from MyFitnessPal /
 * MacroFactor can see at a glance that Suppr does not stop at protein.
 *
 * Scope is intentionally narrow:
 *  - 4 tiles: Fibre, Iron, Vitamin D, Sodium.
 *  - %DV bar derived from `dailyValuePercent` (FDA 2020 reference table).
 *  - No bottom sheet, no settings toggle, no full nutrient panel — those
 *    surfaces already exist via `TodayNutrientsModal` (the existing
 *    Nutrients link in `TodayDashboardMacroTiles`).
 *
 * Sodium colour ramp: success up to 80% of the 2300mg limit, warning
 * 80%-99%, danger at 100%+. Other nutrients stay on the success ramp;
 * over-target is fine for fibre/iron/vitamin D so we cap the bar at
 * 100% width but leave the colour green.
 *
 * Web parity: `src/app/components/suppr/today-micros-widget.tsx`.
 */

export interface TodayMicrosWidgetProps {
  /**
   * Day-summed micros — use the result of
   * `sumMicrosFromLoggedMeals(mealsToday)` directly. Missing keys are
   * treated as zero.
   */
  microSum: Record<string, number> | null | undefined;
  /**
   * Day-totalled fibre in grams. Comes from the dedicated `fiberG` meal
   * column path (see `mealContributedFiberG`); the widget reads it
   * separately so it survives meals that store fibre on the column but
   * have no `micros.fiberG` key.
   */
  fiberG: number;
  cardColor: string;
  cardBorderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

type TileKey = "fiberG" | "ironMg" | "vitaminDMcg" | "sodiumMg";

type TileSpec = {
  key: TileKey;
  label: string;
  unit: "g" | "mg" | "mcg";
  /** DV reference for the "X / Y" caption text. */
  reference: number;
};

/** Order is the canonical left-to-right reading order in the scroll row. */
const TILE_SPECS: ReadonlyArray<TileSpec> = [
  { key: "fiberG", label: "Fiber", unit: "g", reference: 28 },
  { key: "ironMg", label: "Iron", unit: "mg", reference: 18 },
  { key: "vitaminDMcg", label: "Vit D", unit: "mcg", reference: 20 },
  { key: "sodiumMg", label: "Sodium", unit: "mg", reference: 2300 },
];

/**
 * Pick the bar colour for a tile. Limit nutrients (sodium) ramp from
 * success → warning → danger as %DV climbs; target nutrients stay
 * success regardless of overshoot (going over fibre / iron / vit D is
 * not a warning).
 */
function tileColorForPercent(key: TileKey, pct: number | null): string {
  if (pct === null) return Accent.success;
  if (!isLimitNutrient(key)) return Accent.success;
  if (pct >= 100) return Accent.destructive;
  if (pct >= 80) return Accent.warning;
  return Accent.success;
}

/** Format the headline value for a tile (e.g. "24g"). */
function formatAmount(amount: number, unit: TileSpec["unit"]): string {
  if (unit === "g") {
    // Fibre rounded to nearest whole gram.
    return `${Math.round(amount)}g`;
  }
  if (unit === "mg") {
    return `${Math.round(amount)}mg`;
  }
  return `${Math.round(amount)}mcg`;
}

export function TodayMicrosWidget({
  microSum,
  fiberG,
  cardColor,
  cardBorderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
}: TodayMicrosWidgetProps) {
  const sum = microSum ?? {};

  return (
    <View style={{ marginBottom: Spacing.md }} accessibilityLabel="Micronutrients">
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: textTertiaryColor,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          marginBottom: Spacing.sm,
        }}
      >
        Micronutrients
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}
      >
        {TILE_SPECS.map((spec) => {
          // Fibre comes from the dedicated meal-column path so the
          // widget agrees with the existing Today fibre headline.
          const amount =
            spec.key === "fiberG"
              ? fiberG
              : typeof sum[spec.key] === "number" && Number.isFinite(sum[spec.key])
                ? sum[spec.key]
                : 0;
          const pct = dailyValuePercent(spec.key, amount);
          const color = tileColorForPercent(spec.key, pct);
          // Cap the bar fill at 100% so over-target sodium doesn't
          // overflow the track. The %DV caption still reads >100% so
          // the user sees the actual value.
          const barWidthPct = Math.min(100, Math.max(0, pct ?? 0));

          return (
            <View
              key={spec.key}
              testID={`today-micros-tile-${spec.key}`}
              style={{
                width: 144,
                backgroundColor: cardColor,
                borderWidth: 1,
                borderColor: cardBorderColor,
                borderRadius: Radius.lg,
                padding: Spacing.md,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: textTertiaryColor,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                  marginBottom: Spacing.xs,
                }}
              >
                {spec.label}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: textColor,
                  fontVariant: ["tabular-nums"],
                  marginBottom: Spacing.xs,
                }}
                numberOfLines={1}
              >
                {formatAmount(amount, spec.unit)}{" "}
                <Text style={{ fontSize: 12, fontWeight: "500", color: textSecondaryColor }}>
                  / {spec.reference}{spec.unit}
                </Text>
              </Text>
              <View
                style={{
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: `${color}24`,
                  overflow: "hidden",
                }}
                testID={`today-micros-bar-${spec.key}`}
                // Track colour exposed via accessibilityValue so tests
                // can assert the colour ramp without traversing styles.
                accessibilityValue={{ now: pct ?? 0, min: 0, max: 100 }}
              >
                <View
                  style={{
                    width: `${barWidthPct}%`,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: color,
                  }}
                  testID={`today-micros-bar-fill-${spec.key}`}
                />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  color: textSecondaryColor,
                  marginTop: Spacing.xs + 2,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {pct === null ? "—" : `${pct}% DV`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default TodayMicrosWidget;
