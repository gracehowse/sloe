import React from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { Layout } from "@/constants/layout";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { carbsLabel, netCarbsForRow } from "@suppr/shared/nutrition/netCarbs";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";

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
  const cardElevation = useCardElevation();
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
      color: MacroColors.protein,
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
      color: MacroColors.carbs,
      unit: "g",
    },
    fat: {
      label: "Fat",
      current: totals.fat,
      target: targets.fat,
      color: MacroColors.fat,
      unit: "g",
    },
    fiber: {
      label: "Fiber",
      current: totals.fiber,
      target: targets.fiber,
      color: Accent.success,
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
      style={[
        {
          backgroundColor: cardElevation.liftBg ?? cardColor,
          borderColor: cardBorderColor,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderRadius: Radius.lg,
          padding: Spacing.sm + 2,
          marginBottom: Spacing.sm,
          gap: Layout.todayScrollGap,
        } as ViewStyle,
        cardElevation.shadowStyle,
      ]}
      testID="today-macro-bars"
    >
      {/* Canonical 2026-05-22 C1: each macro is a single row —
          UPPERCASE label + bar fill + value/target with inline caption
          ("· 12 over" / "· 18 left"). No separate caption row — captions
          inline per C1.a. Bar fill at 100% is the over signal. */}
      {trackedMacros.map((macro) => {
        const def = barMap[macro];
        if (!def) return null;
        const value = formatMacro(def.current, macro);
        const targetLabel = formatMacro(def.target, macro);
        const pct =
          def.target > 0
            ? Math.min(100, Math.max(0, (def.current / def.target) * 100))
            : 0;
        const remainDisplayed = def.target - def.current;
        const overBy = Math.round(Math.abs(remainDisplayed));
        const inlineCaption =
          def.current <= 0 && def.target > 0
            ? null
            : remainDisplayed >= 0
              ? `${overBy} ${def.unit} left`
              : `${overBy} ${def.unit} over`;
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
                gap: Spacing.sm,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: textSecondaryColor,
                  flexShrink: 0,
                }}
              >
                {def.label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: textSecondaryColor,
                  fontVariant: ["tabular-nums"],
                  flexShrink: 1,
                  textAlign: "right",
                }}
                numberOfLines={1}
              >
                <Text style={{ fontWeight: "700", color: textColor }}>
                  {value}
                </Text>
                {" / "}
                {targetLabel} {def.unit}
                {inlineCaption ? (
                  <Text style={{ color: textSecondaryColor }}>
                    {"  ·  "}
                    {inlineCaption}
                  </Text>
                ) : null}
              </Text>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: `${def.color}28`,
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
