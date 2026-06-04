import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Accent, MacroColors, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprCard } from "@/components/ui/SupprCard";
import { formatPlannedMealMacroParts } from "@suppr/shared/nutrition/plannedMealDisplay";
import { PortionPickerSheet } from "./PortionPickerSheet";

/**
 * TodayPlannedMealsCard — "Planned" list on the Today screen when the
 * user has a meal plan row for the day.
 *
 * Sloe `TD3 · Weekly insight + Planned` re-skin (Today re-skin unit 3,
 * 2026-06-03). Figma 480:2 / `docs/prototypes/stitch-sloe/today-insight.html`
 * — a "Planned" section header (Newsreader) over a warm-grey card of divided
 * rows: each row = recipe name (Newsreader) · kcal + coloured P/C/F · a
 * "Log today" clay link.
 *
 * Re-skin only — NO data/logic change. The "Log today" path still opens the
 * in-app `PortionPickerSheet` and fires the host's
 * `onLogPlannedMealWithPortion`, which keeps the Verify-first guard (never
 * logs coerced macros) and routes durable logs through
 * `refreshAdaptiveTdeeForUser`. None of that lives here.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). 2026-04-30: replaced system `Alert.alert` portion picker
 * with the in-app `PortionPickerSheet` (customer-lens audit — system
 * iOS alerts mid-flow read as prototype-tier).
 */
export type TodayPlannedMealEntry = {
  name?: string;
  recipe_title?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Lets the Today log path pull fiber/sugar/sodium from the saved recipe. */
  recipe_id?: string | null;
};

export interface TodayPlannedMealsCardProps {
  plannedMeals: TodayPlannedMealEntry[];
  onLogPlannedMealWithPortion: (pm: TodayPlannedMealEntry, portion: number) => void;
  /** Retained for host call-site compatibility; the card now owns its Sloe
   *  styling. Unused visually. */
  styles?: Record<string, any>;
}

/** kcal · coloured P/C/F line for one planned row (frame: `191 kcal · 27g P
 *  · 2g C · 9g F`). Same rounding as the planner's single-string formatter
 *  via the shared `formatPlannedMealMacroParts`. */
function MacroLine({
  meal,
  textSecondaryColor,
}: {
  meal: TodayPlannedMealEntry;
  textSecondaryColor: string;
}) {
  const parts = formatPlannedMealMacroParts(
    Number(meal.calories) || 0,
    Number(meal.protein) || 0,
    Number(meal.carbs) || 0,
    Number(meal.fat) || 0,
  );
  return (
    <Text style={{ ...Type.caption, color: textSecondaryColor, marginTop: 2 }}>
      <Text style={{ fontVariant: ["tabular-nums"] }}>{parts.kcal.toLocaleString()} kcal</Text>
      {" · "}
      <Text style={{ color: MacroColors.protein, fontVariant: ["tabular-nums"] }}>{parts.protein}g P</Text>
      {" · "}
      <Text style={{ color: MacroColors.carbs, fontVariant: ["tabular-nums"] }}>{parts.carbs}g C</Text>
      {" · "}
      <Text style={{ color: MacroColors.fat, fontVariant: ["tabular-nums"] }}>{parts.fat}g F</Text>
    </Text>
  );
}

export function TodayPlannedMealsCard({
  plannedMeals,
  onLogPlannedMealWithPortion,
}: TodayPlannedMealsCardProps) {
  const colors = useThemeColors();
  const [picker, setPicker] = useState<{ meal: TodayPlannedMealEntry } | null>(null);

  return (
    <View>
      {/* Sloe TD3 "Planned" section header — Newsreader title above the card. */}
      <Text style={{ ...Type.title, color: MacroColors.calories, marginBottom: Spacing.sm }}>Planned</Text>

      {/* Card chrome (fill, radius 20, soft lift on an outer wrapper, corner-clip
          on the inner view, dark hairline) is the shared <SupprCard> shell. The
          divided rows are the inner contents; padding="none" because each row
          owns its own padding. */}
      <SupprCard padding="none">
        {plannedMeals.map((pm, i) => {
          const name = pm.recipe_title ?? pm.name ?? "Planned meal";
          return (
            <View
              key={`planned-${i}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.md,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...Type.headline, color: colors.text }} numberOfLines={1}>
                  {name}
                </Text>
                <MacroLine meal={pm} textSecondaryColor={colors.textSecondary} />
              </View>
              <Pressable
                onPress={() => setPicker({ meal: pm })}
                accessibilityRole="button"
                accessibilityLabel={`Log ${name} today`}
                hitSlop={8}
                style={{ paddingHorizontal: 8, paddingVertical: 12 }}
              >
                <Text style={{ ...Type.label, color: Accent.primarySolid }}>Log today</Text>
              </Pressable>
            </View>
          );
        })}
      </SupprCard>

      <PortionPickerSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        mealName={picker?.meal.recipe_title ?? picker?.meal.name ?? ""}
        onPick={(portion) => {
          if (picker) onLogPlannedMealWithPortion(picker.meal, portion);
        }}
      />
    </View>
  );
}

export default TodayPlannedMealsCard;
