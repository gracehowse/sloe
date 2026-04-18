import React from "react";
import { Pressable, Text, View } from "react-native";
import { Accent, MacroColors } from "@/constants/theme";
import type { JournalMeal } from "@/lib/nutritionJournal";

/**
 * TodayDashboardMacroTiles — renders the `trackedMacros` tiles.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). Matches the web ordering and keys.
 */
export interface TodayDashboardMacroTilesProps {
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
  textTertiaryColor: string;
}

export function TodayDashboardMacroTiles({
  trackedMacros,
  totals,
  targets,
  totalWaterMl,
  waterGoalMl,
  mealsToday,
  onPressMacro,
  cardColor,
  cardBorderColor,
  borderColor,
  textColor,
  textTertiaryColor,
}: TodayDashboardMacroTilesProps) {
  const microSum = mealsToday.reduce(
    (a, m) => ({
      sugarG: a.sugarG + ((m.micros as any)?.sugarG ?? 0),
      sodiumMg: a.sodiumMg + ((m.micros as any)?.sodiumMg ?? 0),
    }),
    { sugarG: 0, sodiumMg: 0 },
  );
  const macroMap: Record<string, { label: string; cur: number; tgt: number; color: string; unit: string }> = {
    protein: { label: "Protein", cur: totals.protein, tgt: targets.protein, color: MacroColors.protein, unit: "g" },
    carbs: { label: "Carbs", cur: totals.carbs, tgt: targets.carbs, color: MacroColors.carbs, unit: "g" },
    fat: { label: "Fat", cur: totals.fat, tgt: targets.fat, color: MacroColors.fat, unit: "g" },
    fiber: { label: "Fiber", cur: totals.fiber, tgt: targets.fiber, color: Accent.success, unit: "g" },
    sugar: { label: "Sugar", cur: Math.round(microSum.sugarG * 10) / 10, tgt: 50, color: Accent.warning, unit: "g" },
    sodium: { label: "Sodium", cur: Math.round(microSum.sodiumMg), tgt: 2300, color: Accent.destructive, unit: "mg" },
    water: { label: "Water", cur: totalWaterMl, tgt: waterGoalMl, color: MacroColors.water ?? Accent.info, unit: "ml" },
  };
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {trackedMacros.map((macro) => {
        const m = macroMap[macro];
        if (!m) return null;
        const displayAmount = macro === "fiber" ? Math.round(m.cur * 10) / 10 : Math.round(m.cur);
        return (
          <Pressable
            key={macro}
            onPress={() => onPressMacro(macro)}
            style={{
              flex: 1,
              minWidth: 70,
              padding: 10,
              borderRadius: 12,
              backgroundColor: cardColor,
              borderWidth: 1,
              borderColor: cardBorderColor,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: m.color }} />
              <Text style={{ fontSize: 10, fontWeight: "600", color: textTertiaryColor, letterSpacing: 0.5 }}>
                {m.label}
              </Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: textColor, fontVariant: ["tabular-nums"] }}>
              {displayAmount}
              {m.unit}
            </Text>
            <View style={{ marginTop: 5, height: 4, borderRadius: 2, backgroundColor: borderColor }}>
              <View
                style={{
                  width: `${Math.min(m.cur / Math.max(m.tgt, 1), 1) * 100}%`,
                  height: "100%",
                  borderRadius: 2,
                  backgroundColor: m.color,
                }}
              />
            </View>
            <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 3, fontVariant: ["tabular-nums"] }}>
              {m.cur < m.tgt ? `${Math.round(m.tgt - m.cur)}${m.unit} left` : `of ${m.tgt}${m.unit}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default TodayDashboardMacroTiles;
