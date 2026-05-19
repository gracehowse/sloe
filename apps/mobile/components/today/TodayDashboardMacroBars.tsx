import React from "react";
import { Pressable, Text, View } from "react-native";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { carbsLabel, netCarbsForRow } from "@suppr/shared/nutrition/netCarbs";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";
import { useTarePalette } from "@/lib/tareAesthetic";

/**
 * TodayDashboardMacroBars — alternative macro display: a vertical
 * stack of "Name … Value / Target" rows, each with a thin filled bar
 * below. Selectable via Settings → Display & extras → Macro display.
 *
 * Same input contract as {@link TodayDashboardMacroTiles}; only the
 * visual treatment differs. The tiles variant remains the default;
 * Grace asked for bars as a user-configurable alternative (the bar
 * style mirrors the Cronometer / Lose It list aesthetic and packs more
 * macros per vertical inch). Pref persisted via
 * `apps/mobile/lib/macroDisplayStyle.ts`.
 */
export interface TodayDashboardMacroBarsProps {
  trackedMacros: string[];
  totals: { protein: number; carbs: number; fat: number; fiber: number };
  targets: { protein: number; carbs: number; fat: number; fiber: number };
  totalWaterMl: number;
  waterGoalMl: number;
  mealsToday: JournalMeal[];
  onPressMacro: (macro: string) => void;
  cardColor: string;
  cardBorderColor: string;
  borderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  mutedColor: string;
  netCarbsLensEnabled?: boolean;
}

type BarDef = {
  label: string;
  current: number;
  target: number;
  color: string;
  unit: string;
};

export function TodayDashboardMacroBars({
  trackedMacros,
  totals,
  targets,
  totalWaterMl,
  waterGoalMl,
  mealsToday,
  onPressMacro,
  cardColor,
  cardBorderColor,
  textColor,
  textSecondaryColor,
  netCarbsLensEnabled,
}: TodayDashboardMacroBarsProps) {
  // 2026-05-19 (Tare V1.2 parity fix) — route macro bar colours
  // through the Tare palette so this view matches CalorieRing +
  // TodayDashboardMacroTiles + TodayWeekView when Tare is on.
  // Fiber: legacy was Accent.success (bright green); Tare routes to
  // macroFiber (sage) instead. Sodium/sugar/water keep legacy
  // mappings — they're not part of the four primary macros.
  const tare = useTarePalette();
  const proteinColor = tare?.macroProtein ?? MacroColors.protein;
  const carbsColor = tare?.macroCarbs ?? MacroColors.carbs;
  const fatColor = tare?.macroFat ?? MacroColors.fat;
  const fiberColor = tare?.macroFiber ?? Accent.success;

  const microSum = mealsToday.reduce(
    (a, m) => ({
      sugarG:
        a.sugarG +
        ((m.micros as { sugarG?: number } | null | undefined)?.sugarG ?? 0),
      sodiumMg:
        a.sodiumMg +
        ((m.micros as { sodiumMg?: number } | null | undefined)?.sodiumMg ?? 0),
    }),
    { sugarG: 0, sodiumMg: 0 },
  );

  const barMap: Record<string, BarDef> = {
    protein: {
      label: "Protein",
      current: totals.protein,
      target: targets.protein,
      color: proteinColor,
      unit: "g",
    },
    carbs: {
      label: carbsLabel(targets.fiber, Boolean(netCarbsLensEnabled)),
      current: netCarbsForRow(
        totals.carbs,
        totals.fiber,
        Boolean(netCarbsLensEnabled),
      ),
      target: netCarbsForRow(
        targets.carbs,
        targets.fiber,
        Boolean(netCarbsLensEnabled),
      ),
      color: carbsColor,
      unit: "g",
    },
    fat: {
      label: "Fat",
      current: totals.fat,
      target: targets.fat,
      color: fatColor,
      unit: "g",
    },
    fiber: {
      label: "Fiber",
      current: totals.fiber,
      target: targets.fiber,
      color: fiberColor,
      unit: "g",
    },
    sugar: {
      label: "Sugar",
      current: Math.round(microSum.sugarG * 10) / 10,
      target: 50,
      color: Accent.warning,
      unit: "g",
    },
    sodium: {
      label: "Sodium",
      current: Math.round(microSum.sodiumMg),
      target: 2300,
      color: MacroColors.sodium,
      unit: "mg",
    },
    water: {
      label: "Water",
      current: totalWaterMl,
      target: waterGoalMl,
      color: MacroColors.water ?? Accent.info,
      unit: "ml",
    },
  };

  return (
    <View
      style={{
        backgroundColor: cardColor,
        borderColor: cardBorderColor,
        borderWidth: 1,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        gap: Spacing.md,
      }}
      testID="today-macro-bars"
    >
      {trackedMacros.map((macro) => {
        const def = barMap[macro];
        if (!def) return null;
        const value = formatMacro(def.current, macro);
        const targetLabel = formatMacro(def.target, macro);
        const pct =
          def.target > 0
            ? Math.min(100, Math.max(0, (def.current / def.target) * 100))
            : 0;
        return (
          <Pressable
            key={macro}
            onPress={() => onPressMacro(macro)}
            accessibilityRole="button"
            accessibilityLabel={`${def.label}: ${value} of ${targetLabel} ${def.unit}`}
            hitSlop={6}
            testID={`today-macro-bar-${macro}`}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: textColor,
                }}
              >
                {def.label}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: textSecondaryColor,
                  fontVariant: ["tabular-nums"],
                }}
              >
                <Text style={{ fontWeight: "700", color: textColor }}>
                  {value}
                </Text>
                {" / "}
                {targetLabel} {def.unit}
              </Text>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: cardBorderColor,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  backgroundColor: def.color,
                  borderRadius: 3,
                }}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
