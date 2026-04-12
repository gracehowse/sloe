import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { useDiscoverRecipes, useSavedLibraryRecipes } from "@/lib/recipes";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { Neon, MacroColors, Spacing, Radius } from "@/constants/theme";

type PlanMeal = {
  name: string;
  recipeTitle: string;
  /** Stable navigation target; older saved plans may omit this. */
  recipeId?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionMultiplier?: number;
  isPlaceholder?: boolean;
};

type DayPlan = {
  day: number;
  meals: PlanMeal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
};

const SLOTS = ["Breakfast", "Lunch", "Snack", "Dinner"];

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();

  const { recipes: discoverRecipes } = useDiscoverRecipes();
  const { recipes: savedRecipes } = useSavedLibraryRecipes(userId);

  const [plan, setPlan] = useState<DayPlan[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [days, setDays] = useState<1 | 3 | 7>(1);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 120, gap: Spacing.lg },
        headerTitle: {
          fontSize: 22,
          fontWeight: "800",
          color: Neon.purple,
          letterSpacing: 3,
          textAlign: "center",
          paddingVertical: Spacing.md,
        },

        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Neon.pink + "30",
          padding: Spacing.xl,
          gap: Spacing.md,
        },
        cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
        cardDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

        daysRow: { flexDirection: "row", gap: Spacing.sm },
        dayBtn: {
          flex: 1,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
        },
        dayBtnActive: { borderColor: Neon.purple, backgroundColor: Neon.purple + "15" },
        dayBtnText: { color: colors.textTertiary, fontWeight: "600", fontSize: 14 },
        dayBtnTextActive: { color: Neon.purple },

        generateBtn: {
          backgroundColor: Neon.purple,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: "center",
        },
        generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

        dayHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        dayTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
        dayTotals: { fontSize: 12, color: colors.textSecondary, fontVariant: ["tabular-nums"] },

        mealRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        mealSlot: { fontSize: 11, fontWeight: "700", color: Neon.purple, letterSpacing: 1 },
        mealTitle: { fontSize: 15, fontWeight: "500", color: colors.text, marginTop: 2 },
        mealMacros: { fontSize: 11, color: colors.textTertiary, marginTop: 2, fontVariant: ["tabular-nums"] },
        mealChevron: { color: colors.tabIconDefault, fontSize: 22, fontWeight: "600" },

        actionsRow: { gap: Spacing.md },
        regenBtn: {
          borderWidth: 1,
          borderColor: Neon.purple + "50",
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
        },
        regenBtnText: { color: Neon.purple, fontWeight: "700", fontSize: 15 },
      }),
    [colors],
  );

  // Load existing plan from DB
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("meal_plans")
        .select("plan")
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled && data?.plan && Array.isArray(data.plan)) {
        setPlan(data.plan as DayPlan[]);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const generatePlan = useCallback(() => {
    if (savedRecipes.length === 0) {
      Alert.alert("Save recipes first", "Save at least 1 recipe from Discover to generate a plan.");
      return;
    }

    setGenerating(true);

    // Simple client-side plan generation — assigns saved recipes to meal slots
    setTimeout(() => {
      const newPlan: DayPlan[] = [];
      for (let d = 1; d <= days; d++) {
        const meals: PlanMeal[] = SLOTS.map((slot) => {
          const idx = Math.floor(Math.random() * savedRecipes.length);
          const r = savedRecipes[idx]!;
          return {
            name: slot,
            recipeTitle: r.title,
            recipeId: r.id,
            calories: r.calories,
            protein: r.protein,
            carbs: r.carbs,
            fat: r.fat,
          };
        });
        const totals = meals.reduce(
          (a, m) => ({
            calories: a.calories + m.calories,
            protein: a.protein + m.protein,
            carbs: a.carbs + m.carbs,
            fat: a.fat + m.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
        newPlan.push({ day: d, meals, totals });
      }
      setPlan(newPlan);
      setGenerating(false);

      // Persist
      if (userId) {
        void supabase
          .from("meal_plans")
          .upsert({ user_id: userId, plan: newPlan, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      }
    }, 300);
  }, [savedRecipes, days, userId]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>MEAL PLANNER</Text>

        {/* Generate controls */}
        {!plan && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plan your week</Text>
            <Text style={styles.cardDesc}>
              {savedRecipes.length} recipe{savedRecipes.length !== 1 ? "s" : ""} in your library.
              {savedRecipes.length === 0 ? " Save some from Discover first." : ""}
            </Text>

            <View style={styles.daysRow}>
              {([1, 3, 7] as const).map((d) => (
                <Pressable
                  key={d}
                  style={[styles.dayBtn, days === d && styles.dayBtnActive]}
                  onPress={() => setDays(d)}
                >
                  <Text style={[styles.dayBtnText, days === d && styles.dayBtnTextActive]}>
                    {d} day{d > 1 ? "s" : ""}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.generateBtn, savedRecipes.length === 0 && { opacity: 0.4 }]}
              onPress={generatePlan}
              disabled={generating || savedRecipes.length === 0}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.generateBtnText}>Generate Plan</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Plan display */}
        {plan && plan.map((dp) => (
          <View key={dp.day} style={styles.card}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>Day {dp.day}</Text>
              <Text style={styles.dayTotals}>
                {dp.totals.calories} kcal · P {dp.totals.protein}g
              </Text>
            </View>

            {dp.meals.map((meal, i) => (
              <Pressable
                key={i}
                style={styles.mealRow}
                onPress={() => {
                  const id =
                    meal.recipeId ??
                    savedRecipes.find((x) => x.title === meal.recipeTitle)?.id ??
                    discoverRecipes.find((x) => x.title === meal.recipeTitle)?.id;
                  if (id) {
                    router.push(`/recipe/${id}`);
                    return;
                  }
                  Alert.alert(
                    "Recipe unavailable",
                    "This planned meal no longer matches a recipe in your library. Generate a new plan from saved recipes.",
                  );
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealSlot}>{meal.name}</Text>
                  <Text style={styles.mealTitle}>{meal.recipeTitle}</Text>
                  <Text style={styles.mealMacros}>
                    {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
                  </Text>
                </View>
                <Text style={styles.mealChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ))}

        {/* Regenerate */}
        {plan && (
          <View style={styles.actionsRow}>
            <Pressable style={styles.regenBtn} onPress={() => setPlan(null)}>
              <Text style={styles.regenBtnText}>New Plan</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
