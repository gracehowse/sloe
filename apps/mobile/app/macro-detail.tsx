import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useMacroColors } from "@/lib/tareAesthetic";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate } from "@suppr/shared/nutrition/trackerStats";

type Meal = {
  name: string;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  waterMl: number;
};

// 2026-05-14 (premium-bar audit Group H #4): brand-colour mapping for
// all 4 macros + fibre + water. Protein/carbs/fat/fiber/water route
// through `useMacroColors()` so the Tare gate state is honoured.
// 2026-05-19 V1.4: moved from module-level static into a hook (was
// frozen at import time as legacy `MacroColors.*` — when Tare flipped
// on, this screen still rendered legacy colours, causing the
// tab-to-tab drift Grace flagged).
type MacroConfig = Record<
  string,
  { label: string; color: string; unit: string; field: keyof Meal }
>;
function useMacroConfig(): MacroConfig {
  const macroColors = useMacroColors();
  return {
    protein: { label: "Protein", color: macroColors.protein, unit: "g", field: "protein" },
    carbs: { label: "Carbs", color: macroColors.carbs, unit: "g", field: "carbs" },
    fat: { label: "Fat", color: macroColors.fat, unit: "g", field: "fat" },
    fiber: { label: "Fiber", color: macroColors.fiber, unit: "g", field: "fiberG" },
    calories: { label: "Calories", color: macroColors.calories, unit: "kcal", field: "calories" },
    water: { label: "Water", color: macroColors.water, unit: "ml", field: "waterMl" },
  };
}

// 2026-05-14 (premium-bar audit Group H #3): segmented toggle between
// "By meal" (current breakdown grouped by meal slot) and "By ingredient"
// (per-ingredient breakdown). Ingredient breakdown is a TODO — the
// current `nutrition_entries` query doesn't carry per-ingredient
// macro rows. When available, the "By ingredient" view will read
// from `nutrition_entries.components` (or whichever schema lands) and
// render the same row layout keyed on ingredient name.
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

  const MACRO_CONFIG = useMacroConfig();
  const config = MACRO_CONFIG[macro] ?? MACRO_CONFIG.protein;

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>("meal");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // Audit 2026-05-04 #16: previous code had no error/timeout handling
    // — when the request rejected (network wedge, RLS, hung PostgREST),
    // `setLoading(false)` never ran and the screen stayed on "Loading…"
    // forever. Same network-resilience pattern as the c9ebfac perpetual-
    // spinner fix: race the fetch against an 8s deadline so the gate
    // always opens, then either render the list (success) or the empty
    // state (timeout / failure).
    const TIMEOUT_MS = 8_000;
    const finish = () => {
      if (!cancelled) setLoading(false);
    };
    const timer = setTimeout(finish, TIMEOUT_MS);
    supabase
      .from("nutrition_entries")
      .select("name, recipe_title, calories, protein, carbs, fat, fiber_g, water_ml")
      .eq("user_id", userId)
      .eq("date_key", dateKey)
      .order("created_at", { ascending: true })
      .then(({ data: rows }) => {
        if (cancelled) return;
        clearTimeout(timer);
        setMeals(
          (rows ?? []).map((r: any) => ({
            name: r.name ?? "",
            recipeTitle: r.recipe_title ?? "",
            calories: Number(r.calories) || 0,
            protein: Number(r.protein) || 0,
            carbs: Number(r.carbs) || 0,
            fat: Number(r.fat) || 0,
            fiberG: r.fiber_g != null ? Number(r.fiber_g) : 0,
            waterMl: r.water_ml != null ? Number(r.water_ml) : 0,
          })),
        );
        finish();
      }, (err: unknown) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (typeof console !== "undefined") {
          console.warn(
            "[macro-detail] nutrition_entries fetch failed:",
            err instanceof Error ? err.message : err,
          );
        }
        finish();
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, dateKey]);

  const total = meals.reduce((sum, m) => sum + (Number(m[config.field]) || 0), 0);

  // 2026-05-14 (premium-bar audit Group H #3): a meal slot in this
  // codebase is the `name` field on nutrition_entries (Breakfast /
  // Lunch / Dinner / Snack). Group meals by that bucket so the
  // "By meal" view shows aggregated slot totals + a sub-row per meal.
  const mealsBySlot = useMemo(() => {
    const buckets: Record<string, Meal[]> = {};
    for (const m of meals) {
      const slot = m.name || "Other";
      if (!buckets[slot]) buckets[slot] = [];
      buckets[slot].push(m);
    }
    return buckets;
  }, [meals]);

  const slotOrder = useMemo(() => {
    // Canonical meal-slot order so Breakfast renders first even if
    // logged out of sequence. Anything off-canonical keeps insertion
    // order at the tail.
    const canonical = ["Breakfast", "Lunch", "Dinner", "Snack"];
    const present = Object.keys(mealsBySlot);
    const ordered: string[] = [];
    for (const k of canonical) {
      if (present.includes(k)) ordered.push(k);
    }
    for (const k of present) {
      if (!canonical.includes(k)) ordered.push(k);
    }
    return ordered;
  }, [mealsBySlot]);

  return (
    <View testID="screen-macro-detail" style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>{config.label}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{formatDateLabel(dateKey)}</Text>
        </View>
        {/* Numbers audit 2026-05-04 #10 (cross-cuts full-sweep #16):
            header pill was rendering `Math.round(total * 10) / 10` against
            an empty `meals[]` array on first paint — `0g` shown while the
            body said "Loading...". Same screen, two different states for
            the same metric at the same instant. Now: render an em-dash
            placeholder while loading; total only paints once data resolves
            (or empty state triggers). */}
        <View style={{ backgroundColor: config.color + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: config.color, fontVariant: ["tabular-nums"] }}>
            {loading ? `—${config.unit}` : `${Math.round(total * 10) / 10}${config.unit}`}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 40 }}>
        {/* 2026-05-14 (premium-bar audit Group H #3): segmented control
            so the breakdown can pivot between meal slot and ingredient.
            Rendered above the list so the user sees both modes at a
            glance even when "By ingredient" is the active view. */}
        {!loading && meals.length > 0 && (
          <View
            testID="macro-detail-breakdown-toggle"
            accessibilityRole="tablist"
            accessibilityLabel="Breakdown mode"
            style={{
              flexDirection: "row",
              padding: 3,
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
          // their macro, and got a dead end. Add a "Log a meal" CTA
          // that bounces back to Today (where the FAB lives) so the
          // empty state is actionable.
          <View style={{ alignItems: "center", paddingVertical: 40, gap: Spacing.md }}>
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>
              No meals logged for this day
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log a meal on Today"
              onPress={() => router.push("/(tabs)")}
              style={({ pressed }) => ({
                paddingHorizontal: Spacing.xl,
                paddingVertical: 10,
                borderRadius: Radius.md,
                backgroundColor: config.color,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#fff",
                }}
              >
                Log a meal
              </Text>
            </Pressable>
          </View>
        ) : breakdownMode === "ingredient" ? (
          // 2026-05-14 (premium-bar audit Group H #3): ingredient
          // breakdown placeholder. The `nutrition_entries` schema
          // here doesn't carry per-ingredient macro rows yet — only
          // the aggregated meal totals. Until the upstream import +
          // verify pipeline persists component-level breakdowns to
          // a queryable column on `nutrition_entries`, we render an
          // informative empty state with the meal list visible
          // below so the user still has data on screen.
          // TODO(nutrition-engine): wire per-ingredient breakdown
          // once `nutrition_entries.components` (or equivalent) is
          // available — same row shape as meal mode but keyed on
          // ingredient name.
          <View>
            <View
              style={{
                padding: Spacing.lg,
                borderRadius: Radius.md,
                backgroundColor: config.color + "10",
                marginBottom: Spacing.md,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                  textAlign: "center",
                }}
              >
                Per-ingredient breakdown is coming soon — for now, here&apos;s
                your {config.label.toLowerCase()} grouped by meal.
              </Text>
            </View>
            <MealList
              meals={meals}
              config={config}
              total={total}
              colors={colors}
            />
          </View>
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
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      gap: 12,
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

                  {/* Sub-rows — only render when more than one meal in
                      the slot so we don't duplicate the header. */}
                  {slotMeals.length > 1 &&
                    slotMeals.map((meal, i) => {
                      const val = Number(meal[config.field]) || 0;
                      return (
                        <View
                          key={`${slot}-${i}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            paddingLeft: 22,
                            borderBottomWidth: i < slotMeals.length - 1 ? 1 : 0,
                            borderBottomColor: colors.border,
                            gap: 12,
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

/**
 * 2026-05-14 (premium-bar audit Group H #3): the legacy flat meal list
 * is now reusable so the ingredient-breakdown placeholder can fall back
 * to it rather than render an empty surface. Same visual treatment as
 * the pre-toggle screen.
 */
function MealList({
  meals,
  config,
  total,
  colors,
}: {
  meals: Meal[];
  config: { label: string; color: string; unit: string; field: keyof Meal };
  total: number;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ gap: 0 }}>
      {meals.map((meal, i) => {
        const val = Number(meal[config.field]) || 0;
        const pct = total > 0 ? val / total : 0;
        return (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              borderBottomWidth: i < meals.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: config.color,
                opacity: 0.3 + pct * 0.7,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: colors.textTertiary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {meal.name}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: colors.text,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {meal.recipeTitle}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: config.color,
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
}
