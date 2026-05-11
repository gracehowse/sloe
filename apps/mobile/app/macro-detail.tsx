import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate } from "../../../src/lib/nutrition/trackerStats";

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

const MACRO_CONFIG: Record<string, { label: string; color: string; unit: string; field: keyof Meal }> = {
  protein: { label: "Protein", color: MacroColors.protein, unit: "g", field: "protein" },
  carbs: { label: "Carbs", color: MacroColors.carbs, unit: "g", field: "carbs" },
  fat: { label: "Fat", color: MacroColors.fat, unit: "g", field: "fat" },
  fiber: { label: "Fiber", color: Accent.success, unit: "g", field: "fiberG" },
  calories: { label: "Calories", color: Accent.success, unit: "kcal", field: "calories" },
  water: { label: "Water", color: Accent.info, unit: "ml", field: "waterMl" },
};

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

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

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
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading...</Text>
          </View>
        ) : meals.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>No meals logged for this day</Text>
          </View>
        ) : (
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
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: config.color, opacity: 0.3 + pct * 0.7 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {meal.name}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginTop: 2 }} numberOfLines={1}>
                      {meal.recipeTitle}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: config.color, fontVariant: ["tabular-nums"] }}>
                    {Math.round(val * 10) / 10}{config.unit}
                  </Text>
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
