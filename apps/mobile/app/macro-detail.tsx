import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Salad } from "lucide-react-native";

import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { MacroIngredientList } from "@/components/nutrition/MacroIngredientList";
import { NutritionDetailEmptyState } from "@/components/nutrition/NutritionDetailEmptyState";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { dateKeyFromDate } from "@suppr/shared/nutrition/trackerStats";
import { useMacroDetail, type Meal } from "./useMacroDetail";

// 2026-05-14 (premium-bar audit Group H #4): brand-colour mapping for
// all 4 macros + fibre + water. Protein/carbs/fat → MacroColors token
// set. Calories → MacroColors.calories (plum — consistent with the
// calorie ring). Fibre → Accent.success (green for plant fibre, distinct
// from the macro trio). Water → Accent.info (blue, same as Today's
// water tile). ENG-997: calories reconciled from Accent.primary → plum.
const MACRO_CONFIG: Record<string, { label: string; color: string; unit: string; field: keyof Meal }> = {
  protein: { label: "Protein", color: MacroColors.protein, unit: "g", field: "protein" },
  carbs: { label: "Carbs", color: MacroColors.carbs, unit: "g", field: "carbs" },
  fat: { label: "Fat", color: MacroColors.fat, unit: "g", field: "fat" },
  fiber: { label: "Fiber", color: Accent.success, unit: "g", field: "fiberG" },
  calories: { label: "Calories", color: MacroColors.calories, unit: "kcal", field: "calories" },
  water: { label: "Water", color: Accent.info, unit: "ml", field: "waterMl" },
};

// Segmented toggle between "By meal" (breakdown grouped by meal slot) and
// "By ingredient" (per-ingredient breakdown). The ingredient breakdown is
// DERIVED from existing schema (ENG-748 #10) — no `nutrition_entries.components`
// migration: each logged entry carries `recipe_id` + `portion_multiplier`, and
// `recipe_ingredients` rows hold each ingredient's full base-servings macro, so
// per-ingredient contribution = ingredient.<macro> × entry.portion_multiplier,
// reconciled to the entry's stored total. See
// `src/lib/nutrition/macroIngredientBreakdown.ts` for the shared web+mobile logic.
//
// Entries with no recipe (single foods, deleted recipes, AI/photo multi-item
// meals) fall back to one self-named line. AI/photo multi-item splitting needs a
// `nutrition_entry_ingredients` snapshot child table — deferred, see ENG-751
// (tracked separately; not built here). The supported-macros gating + the
// derive/scale/reconcile data flow live in the `useMacroDetail` hook.
type BreakdownMode = "meal" | "ingredient";

function formatDateLabel(dateKey: string): string {
  try {
    const today = dateKeyFromDate(new Date());
    if (dateKey === today) return "Today";
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (dateKey === dateKeyFromDate(y)) return "Yesterday";
    const d = new Date(dateKey + "T12:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateKey;
  }
}

export default function MacroDetailScreen() {
  const { macro: macroParam, date: dateParam } = useLocalSearchParams<{ macro?: string; date?: string }>();
  const macro = typeof macroParam === "string" ? macroParam : "protein";
  const dateKey = typeof dateParam === "string" ? dateParam : dateKeyFromDate(new Date());

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const config = MACRO_CONFIG[macro] ?? MACRO_CONFIG.protein;

  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>("meal");

  // All data + derivation lives in the composition-root hook (ENG-621):
  // entries fetch, batched recipe_ingredients fetch, slot grouping, and the
  // shared derive/scale/reconcile breakdown.
  const {
    meals,
    loading,
    total,
    mealsBySlot,
    slotOrder,
    supportsIngredientBreakdown,
    ingredientBreakdown,
  } = useMacroDetail({ userId, dateKey, macro, field: config.field });

  return (
    <View testID="screen-macro-detail" style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header — DRIFT-04 unified push-screen primitive.
          Right-slot carries the value pill that was previously inline. */}
      <PushScreenHeader
        title={config.label}
        caption={formatDateLabel(dateKey)}
        onBack={() => router.back()}
        rightSlot={
          <View style={{ backgroundColor: config.color + "20", paddingHorizontal: Spacing.dense, paddingVertical: Spacing.sm, borderRadius: Radius.sm }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: config.color, fontVariant: ["tabular-nums"] }}>
              {loading ? `—${config.unit}` : `${Math.round(total * 10) / 10}${config.unit}`}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 40 }}>
        {/* 2026-05-14 (premium-bar audit Group H #3): segmented control
            so the breakdown can pivot between meal slot and ingredient.
            Rendered above the list so the user sees both modes at a
            glance even when "By ingredient" is the active view. */}
        {!loading && meals.length > 0 && supportsIngredientBreakdown && (
          <View
            testID="macro-detail-breakdown-toggle"
            accessibilityRole="tablist"
            accessibilityLabel="Breakdown mode"
            style={{
              flexDirection: "row",
              padding: Spacing.xs,
              backgroundColor: colors.inputBg,
              borderRadius: Radius.full,
              marginBottom: Spacing.md,
            }}
          >
            {(["meal", "ingredient"] as const).map((mode) => {
              const isActive = breakdownMode === mode;
              return (
                <Pressable
                  key={mode}
                  testID={`macro-detail-toggle-${mode}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={mode === "meal" ? "By meal" : "By ingredient"}
                  onPress={() => setBreakdownMode(mode)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: Radius.full,
                    backgroundColor: isActive ? colors.card : "transparent",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? "700" : "500",
                      color: isActive ? colors.text : colors.textSecondary,
                    }}
                  >
                    {mode === "meal" ? "By meal" : "By ingredient"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading...</Text>
          </View>
        ) : meals.length === 0 ? (
          // E13 (2026-05-11 visual sweep): empty state was just
          // "No meals logged for this day" — no anchor, no CTA. The
          // user landed here from Today expecting to learn about
          // their macro, and got a dead end.
          //
          // ENG-825 (2026-05-31 design-direction macro/meal lane): the
          // fixed empty state was a line of text + a full-saturated-macro
          // CTA floating in a sea of whitespace. Now a shared elevated,
          // iconified card with a blue commit CTA + scale-press — same
          // structure the meal-nutrition sibling now uses. Visual changes
          // gated; the OLD flat / saturated-macro path lives in the
          // shared component's flag-OFF branches.
          <NutritionDetailEmptyState
            testID="macro-detail-empty"
            icon={Salad}
            title="No meals logged yet"
            subtitle={`Log a meal to see your ${config.label.toLowerCase()} broken down here.`}
            ctaLabel="Log a meal"
            ctaIcon={Plus}
            ctaA11yLabel="Log a meal on Today"
            ctaColorLegacy={config.color}
            onPress={() => router.push("/(tabs)")}
          />
        ) : breakdownMode === "ingredient" && supportsIngredientBreakdown ? (
          // Per-ingredient breakdown (ENG-748 #10): each logged recipe's
          // `recipe_ingredients` rows are scaled by the entry's
          // `portion_multiplier` and reconciled to the entry's stored macro
          // total, then aggregated by ingredient name across the day. Entries
          // with no recipe (single foods / deleted recipes / AI multi-item
          // meals) fall back to one self-named line. The shared derive/scale/
          // reconcile logic lives in
          // `src/lib/nutrition/macroIngredientBreakdown.ts` (web parity).
          <MacroIngredientList breakdown={ingredientBreakdown} config={config} />
        ) : (
          <View style={{ gap: 0 }}>
            {/* By-meal view: render a slot header per meal slot
                with the slot subtotal, then each meal as a sub-row.
                Single-meal slots collapse to a single visual row
                so we don't show a header + one item. */}
            {slotOrder.map((slot, slotIdx) => {
              const slotMeals = mealsBySlot[slot] ?? [];
              const slotTotal = slotMeals.reduce(
                (s, m) => s + (Number(m[config.field]) || 0),
                0,
              );
              const slotPct = total > 0 ? slotTotal / total : 0;
              return (
                <View key={slot} style={{ marginTop: slotIdx === 0 ? 0 : Spacing.md }}>
                  {/* Slot header row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: Spacing.dense,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      gap: Spacing.dense,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: config.color,
                        opacity: 0.3 + slotPct * 0.7,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.textTertiary,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {slot}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: config.color,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {Math.round(slotTotal * 10) / 10}
                      {config.unit}
                    </Text>
                  </View>

                  {/* Sub-rows — e2e walk 2026-06-10: single-item slots used
                      to hide their row entirely, so "BREAKFAST · 24.6g" gave
                      no clue WHAT contributed the grams without switching to
                      the By-ingredient tab. Render sub-rows whenever the
                      meal name adds information; skip only the true
                      duplicate case (a single entry literally named after
                      the slot, e.g. a quick-add titled "Breakfast"). */}
                  {(slotMeals.length > 1 ||
                    ((slotMeals[0]?.recipeTitle ?? "").trim().toLowerCase() !==
                      slot.trim().toLowerCase() &&
                      (slotMeals[0]?.recipeTitle ?? "").trim() !== "")) &&
                    slotMeals.map((meal, i) => {
                      const val = Number(meal[config.field]) || 0;
                      return (
                        <View
                          key={`${slot}-${i}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: Spacing.sm,
                            paddingLeft: 22,
                            borderBottomWidth: i < slotMeals.length - 1 ? 1 : 0,
                            borderBottomColor: colors.border,
                            gap: Spacing.dense,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "500",
                                color: colors.text,
                              }}
                              numberOfLines={1}
                            >
                              {meal.recipeTitle}
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: colors.textSecondary,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {Math.round(val * 10) / 10}
                            {config.unit}
                          </Text>
                        </View>
                      );
                    })}
                </View>
              );
            })}

            {/* Visual breakdown bar */}
            <View style={{ marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: config.color + "10" }}>
              <View style={{ flexDirection: "row", gap: 2, height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: colors.border }}>
                {meals.map((meal, i) => {
                  const val = Number(meal[config.field]) || 0;
                  const pct = total > 0 ? (val / total) * 100 : 0;
                  return (
                    <View
                      key={i}
                      style={{ width: `${Math.max(pct, 1)}%` as any, height: "100%", backgroundColor: config.color, opacity: 0.4 + (i % 3) * 0.2 }}
                    />
                  );
                })}
              </View>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
                {Math.round(total * 10) / 10}{config.unit} across {meals.length} meal{meals.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

