import React, { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useMacroColors } from "@/lib/macroColors";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprCard } from "@/components/ui/SupprCard";
import { formatPlannedMealMacroParts } from "@suppr/nutrition-core/plannedMealDisplay";
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
  const { colors: macro } = useMacroColors(); // ENG-1223: scheme-resolved macros
  const parts = formatPlannedMealMacroParts(
    Number(meal.calories) || 0,
    Number(meal.protein) || 0,
    Number(meal.carbs) || 0,
    Number(meal.fat) || 0,
  );
  // ENG-1223: scheme-resolved plum — `macro.protein` is #B9A7CC on dark
  // (lightened plum, clears AA at 11px), replacing the old green successLight
  // dark-only hack which was off-hue for v3 (protein is plum, not green).
  const proteinColor = macro.protein;
  return (
    <Text style={{ ...Type.caption, color: textSecondaryColor, marginTop: 2 }}>
      <Text style={{ fontVariant: ["tabular-nums"] }}>{parts.kcal.toLocaleString()} kcal</Text>
      {" · "}
      <Text style={{ color: proteinColor, fontVariant: ["tabular-nums"] }}>{parts.protein}g P</Text>
      {" · "}
      <Text style={{ color: macro.carbs, fontVariant: ["tabular-nums"] }}>{parts.carbs}g C</Text>
      {" · "}
      <Text style={{ color: macro.fat, fontVariant: ["tabular-nums"] }}>{parts.fat}g F</Text>
    </Text>
  );
}

function TodayPlannedMealsCardImpl({
  plannedMeals,
  onLogPlannedMealWithPortion,
}: TodayPlannedMealsCardProps) {
  const colors = useThemeColors();
  const router = useRouter();
  // Secondary accent (Frost flag → damson, else clay) for the "Log today" CTA.
  const accent = useAccent();
  const [picker, setPicker] = useState<{ meal: TodayPlannedMealEntry } | null>(null);
  const cardLift = "flat";

  const isEmpty = plannedMeals.length === 0;

  return (
    <View>
      {/* Sloe TD3 "Planned" section header — Newsreader title above the card. */}
      <Text style={{ ...Type.title, color: colors.navPrimary, marginBottom: Spacing.sm }}>Planned</Text>

      {/* F-178/F-179 (ENG-1065): empty days used to vanish (host hid the whole
          card when plannedMeals was empty), so the Today scroll lost a section
          and the founder read it as inconsistent vs populated days. The empty
          branch now carries the SAME <SupprCard> shell + the SAME "Planned"
          header above, with a calm one-liner and a ghost "Plan your day →"
          affordance into the Plan tab. Padding snaps to the F-159 rhythm
          (Spacing.md = 16) — same horizontal/vertical inset a populated row uses,
          so the two states read as one element in two states. The host always
          mounts this on the day view, empty or not (`today_planned_empty_state`
          collapsed, ENG-1651). */}
      {isEmpty ? (
        <SupprCard lift={cardLift} padding="none">
          <View style={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.dense }}>
            <Text style={{ ...Type.body, color: colors.textSecondary }}>
              Nothing planned for today
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/planner")}
              accessibilityRole="button"
              accessibilityLabel="Plan your day"
              hitSlop={8}
              style={({ pressed }) => ({ alignSelf: "flex-start", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ ...Type.label, color: accent.primarySolid }}>Plan your day →</Text>
            </Pressable>
          </View>
        </SupprCard>
      ) : (
      /* Card chrome (fill, radius, soft lift on an outer wrapper, corner-clip
          on the inner view, dark hairline) is the shared <SupprCard lift="soft">
          shell — soft because the card sits on the Today scroll ground
          (one-treatment, Grace 2026-06-09). The divided rows are the inner
          contents; padding="none" because each row owns its own padding.
          Sits on the Today scroll ground → soft lift. */
      <SupprCard lift={cardLift} padding="none">
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
              {/* "Log today" — compact aubergine OUTLINE pill (Sloe CTA weight
                  map, Spec 2, 2026-06-09). Was bare caps text; per-row primaries
                  read as accent lines, not bare text (bare text = dismissal only).
                  Keeps the caps `Type.label`; hairline `accent.primarySolid` border;
                  full radius. padH/padV snap to the scale (Spacing.dense/xs) — the
                  spec's literal 10/4 is off-token, write-discipline wins. */}
              <Pressable
                onPress={() => setPicker({ meal: pm })}
                accessibilityRole="button"
                accessibilityLabel={`Log ${name} today`}
                hitSlop={8}
                style={({ pressed }) => ({
                  paddingHorizontal: Spacing.dense,
                  paddingVertical: Spacing.xs,
                  borderRadius: Radius.full,
                  borderWidth: 1,
                  borderColor: accent.primarySolid,
                  backgroundColor: pressed ? accent.primarySoft : "transparent",
                })}
              >
                <Text style={{ ...Type.label, color: accent.primarySolid }}>Log today</Text>
              </Pressable>
            </View>
          );
        })}
      </SupprCard>
      )}

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

export const TodayPlannedMealsCard = memo(TodayPlannedMealsCardImpl);

export default TodayPlannedMealsCard;
