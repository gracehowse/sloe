import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  dailyValuePercent,
  isLimitNutrient,
} from "../../../../src/lib/nutrition/dailyValues";
import {
  FullNutrientPanelSheet,
  type FullNutrientPanelSheetColors,
} from "./FullNutrientPanelSheet";
import { FULL_NUTRIENT_PANEL_ROW_COUNT } from "../../../../src/lib/nutrition/fullNutrientPanel";

/**
 * TodayMicrosWidget — 4 horizontal-scroll micronutrient tiles for Today.
 *
 * Closes audit gap #1 (Cronometer-grade micros). Suppr already logs 35+
 * micronutrients via `sumMicrosFromLoggedMeals`; this widget surfaces
 * the 4 most diet-relevant ones (fibre intake, iron, vitamin D status,
 * sodium budget) so the macro-only persona switching from MyFitnessPal
 * / MacroFactor sees at a glance that Suppr does not stop at protein.
 *
 * Below the tile row sits a "View all 35 nutrients" CTA — tapping it
 * opens the `FullNutrientPanelSheet` (audit gap #1 follow-up,
 * 2026-05-01) which renders ALL 35 curated nutrients across Macros /
 * Vitamins / Minerals with %DV bars sorted descending so deficiencies
 * surface first.
 *
 * Sodium colour ramp: success up to 80% of the 2300mg limit, warning
 * 80%-99%, danger at 100%+. Other tile-headline nutrients stay on the
 * success ramp; over-target is fine for fibre/iron/vitamin D so we cap
 * the bar at 100% width but leave the colour green.
 *
 * Web parity: `src/app/components/suppr/today-micros-widget.tsx`.
 */

export interface TodayMicrosWidgetProps {
  /**
   * Day-summed micros — pass `sumMicrosFromLoggedMeals(mealsToday)`
   * directly. Missing keys are treated as zero.
   */
  microSum: Record<string, number> | null | undefined;
  /**
   * Day-totalled fibre in grams. Comes from the dedicated `fiberG`
   * meal column path (see `mealContributedFiberG`).
   */
  fiberG: number;
  /** Optional macro day totals — passed straight through to the panel
   *  sheet so its Macros section reflects the same totals shown on the
   *  macro tiles. The 4-tile row above uses only fibre + sodium. */
  totalFatG?: number;
  saturatedFatG?: number;
  totalCarbsG?: number;
  proteinG?: number;
  sugarG?: number;
  cholesterolMg?: number;
  cardColor: string;
  cardBorderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  /** Sheet colors. Defaults to widget colors when omitted, but Today
   *  passes the full theme palette so the sheet matches the screen
   *  background, not the card chip. */
  sheetColors?: FullNutrientPanelSheetColors;
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

function tileColorForPercent(key: TileKey, pct: number | null): string {
  if (pct === null) return Accent.success;
  if (!isLimitNutrient(key)) return Accent.success;
  if (pct >= 100) return Accent.destructive;
  if (pct >= 80) return Accent.warning;
  return Accent.success;
}

function formatAmount(amount: number, unit: TileSpec["unit"]): string {
  if (unit === "g") return `${Math.round(amount)}g`;
  if (unit === "mg") return `${Math.round(amount)}mg`;
  return `${Math.round(amount)}mcg`;
}

export function TodayMicrosWidget({
  microSum,
  fiberG,
  totalFatG,
  saturatedFatG,
  totalCarbsG,
  proteinG,
  sugarG,
  cholesterolMg,
  cardColor,
  cardBorderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  sheetColors,
}: TodayMicrosWidgetProps) {
  const sum = microSum ?? {};
  const [panelOpen, setPanelOpen] = React.useState(false);

  const resolvedSheetColors: FullNutrientPanelSheetColors = sheetColors ?? {
    background: cardColor,
    card: cardColor,
    cardBorder: cardBorderColor,
    text: textColor,
    textSecondary: textSecondaryColor,
    textTertiary: textTertiaryColor,
  };

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
          const amount =
            spec.key === "fiberG"
              ? fiberG
              : typeof sum[spec.key] === "number" && Number.isFinite(sum[spec.key])
                ? sum[spec.key]
                : 0;
          const pct = dailyValuePercent(spec.key, amount);
          const color = tileColorForPercent(spec.key, pct);
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
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: textSecondaryColor,
                  }}
                >
                  / {spec.reference}
                  {spec.unit}
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

      {/* CTA chip — opens the full nutrient panel sheet. */}
      <Pressable
        testID="today-micros-view-all-cta"
        accessibilityRole="button"
        accessibilityLabel={`View all ${FULL_NUTRIENT_PANEL_ROW_COUNT} nutrients`}
        onPress={() => setPanelOpen(true)}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          marginTop: Spacing.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs + 2,
          borderRadius: 999,
          backgroundColor: cardColor,
          borderWidth: 1,
          borderColor: cardBorderColor,
          opacity: pressed ? 0.7 : 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        })}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: textColor,
          }}
        >
          View all {FULL_NUTRIENT_PANEL_ROW_COUNT} nutrients
        </Text>
        <ChevronRight size={14} color={textSecondaryColor} strokeWidth={2.25} />
      </Pressable>

      <FullNutrientPanelSheet
        visible={panelOpen}
        onClose={() => setPanelOpen(false)}
        microSum={microSum}
        fiberG={fiberG}
        totalFatG={totalFatG}
        saturatedFatG={saturatedFatG}
        totalCarbsG={totalCarbsG}
        proteinG={proteinG}
        sugarG={sugarG}
        cholesterolMg={cholesterolMg}
        colors={resolvedSheetColors}
      />
    </View>
  );
}

export default TodayMicrosWidget;
