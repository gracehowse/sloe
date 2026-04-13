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
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { Ionicons } from "@expo/vector-icons";
import { Neon, MacroColors, Spacing, Radius } from "@/constants/theme";
import { generateSmartPlan, ALL_MEAL_SLOTS, type PlannerTargets } from "@/lib/mealPlanAlgo";

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
  const [planTargets, setPlanTargets] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [enabledSlots, setEnabledSlots] = useState<Set<string>>(new Set(ALL_MEAL_SLOTS));

  const swapMeal = useCallback((dayIndex: number, mealIndex: number, slotName: string) => {
    // Filter recipes that fit this slot
    const fits = savedRecipes.filter((r) => {
      const tags = r.mealSlots ?? [];
      return tags.length === 0 || tags.some((t: string) => t.toLowerCase() === slotName.toLowerCase());
    });
    if (fits.length === 0) {
      Alert.alert("No alternatives", "Save more recipes tagged as " + slotName + " to swap.");
      return;
    }
    const options = fits.slice(0, 8).map((r) => r.title);
    options.push("Cancel");
    Alert.alert("Swap " + slotName, "Pick a replacement:", options.map((label, idx) => ({
      text: label,
      style: idx === options.length - 1 ? "cancel" as const : "default" as const,
      onPress: idx === options.length - 1 ? undefined : () => {
        const picked = fits[idx];
        if (!picked || !plan) return;
        setPlan((prev) => {
          if (!prev) return prev;
          return prev.map((dp, di) => {
            if (di !== dayIndex) return dp;
            const newMeals = dp.meals.map((m, mi) => {
              if (mi !== mealIndex) return m;
              return {
                ...m,
                recipeTitle: picked.title,
                recipeId: picked.id,
                calories: picked.calories,
                protein: picked.protein,
                carbs: picked.carbs,
                fat: picked.fat,
                portionMultiplier: undefined,
              };
            });
            const totals = newMeals.reduce(
              (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 },
            );
            return { ...dp, meals: newMeals, totals };
          });
        });
      },
    })));
  }, [savedRecipes, plan]);

  const toggleSlot = useCallback((slot: string) => {
    setEnabledSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) {
        if (next.size <= 1) return prev; // Must keep at least one
        next.delete(slot);
      } else {
        next.add(slot);
      }
      return next;
    });
  }, []);

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

  const generatePlan = useCallback(async () => {
    if (savedRecipes.length === 0) {
      Alert.alert("Save recipes first", "Save at least 1 recipe from Discover to generate a plan.");
      return;
    }

    setGenerating(true);

    // Smart macro-aware plan generation
    {
      // Load targets from user profile
      let profileCals = 2000;
      let profilePro = 150;
      let profileCarbs = 200;
      let profileFat = 65;
      if (userId) {
        const { data } = await supabase
          .from("profiles")
          .select("target_calories, target_protein, target_carbs, target_fat")
          .eq("id", userId)
          .single();
        if (data) {
          profileCals = data.target_calories ?? profileCals;
          profilePro = data.target_protein ?? profilePro;
          profileCarbs = data.target_carbs ?? profileCarbs;
          profileFat = data.target_fat ?? profileFat;
        }
      }

      const targets: PlannerTargets = {
        calories: profileCals,
        protein: profilePro,
        carbs: profileCarbs,
        fat: profileFat,
        calorieBandPct: 12,
        carbFatBandPct: 18,
      };

      const newPlan = generateSmartPlan({
        recipes: savedRecipes.map((r) => ({
          id: r.id,
          title: r.title,
          calories: r.calories,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
          mealType: r.mealSlots ?? null,
        })),
        targets,
        days,
        slotConfig: { slots: ALL_MEAL_SLOTS.filter((s) => enabledSlots.has(s)) },
      });

      setPlan(newPlan);
      setPlanTargets({ calories: profileCals, protein: profilePro, carbs: profileCarbs, fat: profileFat });
      setGenerating(false);

      // Persist
      if (userId) {
        void supabase
          .from("meal_plans")
          .upsert({ user_id: userId, plan: newPlan, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      }
    }
  }, [savedRecipes, days, userId, enabledSlots]);

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

            {/* Meal slot toggles */}
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1 }}>
              INCLUDE MEALS
            </Text>
            <View style={styles.daysRow}>
              {ALL_MEAL_SLOTS.map((slot) => {
                const active = enabledSlots.has(slot);
                return (
                  <Pressable
                    key={slot}
                    style={[styles.dayBtn, active && styles.dayBtnActive]}
                    onPress={() => toggleSlot(slot)}
                  >
                    <Ionicons
                      name={active ? "checkmark-circle" : "ellipse-outline"}
                      size={14}
                      color={active ? "#fff" : colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
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
        {plan && plan.map((dp, dayIdx) => (
          <View key={dp.day} style={styles.card}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>Day {dp.day}</Text>
              <Text style={styles.dayTotals}>{dp.totals.calories} kcal</Text>
            </View>
            {planTargets && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                {([
                  { label: "P", val: dp.totals.protein, target: planTargets.protein, color: MacroColors.protein },
                  { label: "C", val: dp.totals.carbs, target: planTargets.carbs, color: MacroColors.carbs },
                  { label: "F", val: dp.totals.fat, target: planTargets.fat, color: MacroColors.fat },
                ] as const).map(({ label, val, target, color }) => {
                  const diff = val - target;
                  const pct = target > 0 ? Math.abs(diff) / target : 0;
                  const isClose = pct < 0.15;
                  return (
                    <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color }}>{label} {val}g</Text>
                      <Text style={{ fontSize: 10, color: isClose ? Neon.green : diff > 0 ? Neon.red : Neon.yellow }}>
                        {isClose ? "✓" : diff > 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {dp.meals.map((meal, i) => (
              <Pressable
                key={i}
                style={styles.mealRow}
                onLongPress={() => swapMeal(dayIdx, i, meal.name)}
                onPress={() => {
                  const id =
                    meal.recipeId ??
                    savedRecipes.find((x) => x.title === meal.recipeTitle)?.id ??
                    discoverRecipes.find((x) => x.title === meal.recipeTitle)?.id;
                  if (id) {
                    const mult = meal.portionMultiplier ?? 1;
                    router.push(`/recipe/${id}?portion=${mult}`);
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
                  <Text style={styles.mealTitle}>
                    {meal.recipeTitle}
                    {meal.portionMultiplier && meal.portionMultiplier !== 1 ? ` (${meal.portionMultiplier}x)` : ""}
                  </Text>
                  <Text style={styles.mealMacros}>
                    {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
                  </Text>
                </View>
                {/* Log to tracker */}
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    const dk = dateKeyFromDate(new Date());
                    // Write directly to nutrition journal
                    supabase
                      .from("nutrition_journals")
                      .select("by_day")
                      .eq("user_id", userId!)
                      .maybeSingle()
                      .then(({ data }) => {
                        const byDay = (data?.by_day ?? {}) as Record<string, any[]>;
                        const entry = {
                          id: `plan_${Date.now()}_${i}`,
                          name: meal.name,
                          recipeTitle: meal.recipeTitle,
                          time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                          calories: meal.calories,
                          protein: meal.protein,
                          carbs: meal.carbs,
                          fat: meal.fat,
                        };
                        const updated = { ...byDay, [dk]: [...(byDay[dk] ?? []), entry] };
                        supabase
                          .from("nutrition_journals")
                          .upsert({ user_id: userId, by_day: updated, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
                          .then(() => {
                            Alert.alert("Logged", `${meal.recipeTitle} added to today's ${meal.name}.`);
                          });
                      });
                  }}
                  style={{ paddingHorizontal: 8, paddingVertical: 12 }}
                >
                  <Ionicons name="add-circle-outline" size={22} color={Neon.purple} />
                </Pressable>
                <Text style={styles.mealChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ))}

        {/* Actions */}
        {plan && (
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.generateBtn}
              onPress={async () => {
                if (!userId || !plan) return;
                setGenerating(true);
                try {
                  // Collect recipe IDs — resolve by title if ID is missing (older plans)
                  const allRecipes = [...savedRecipes, ...discoverRecipes];
                  const recipeIds = [...new Set(
                    plan.flatMap((dp) => dp.meals.map((m) => {
                      if (m.recipeId) return m.recipeId;
                      return allRecipes.find((r) => r.title === m.recipeTitle)?.id;
                    }).filter(Boolean)) as string[],
                  )];
                  if (recipeIds.length === 0) {
                    Alert.alert("No recipes found", "Try generating a new plan first — your current plan may have been created before recipes were linked.");
                    setGenerating(false);
                    return;
                  }

                  // Fetch ingredients for all planned recipes
                  const { data: ingredients } = await supabase
                    .from("recipe_ingredients")
                    .select("name, amount, unit, recipe_id")
                    .in("recipe_id", recipeIds);

                  if (!ingredients || ingredients.length === 0) {
                    Alert.alert("No ingredients", "Couldn't find ingredients for the planned recipes.");
                    setGenerating(false);
                    return;
                  }

                  // Count how many times each recipe appears in the plan
                  const recipeCounts: Record<string, number> = {};
                  const recipeTitles: Record<string, string> = {};
                  for (const dp of plan) {
                    for (const m of dp.meals) {
                      const rid = m.recipeId ?? allRecipes.find((r) => r.title === m.recipeTitle)?.id;
                      if (rid) {
                        recipeCounts[rid] = (recipeCounts[rid] ?? 0) + 1;
                        recipeTitles[rid] = m.recipeTitle;
                      }
                    }
                  }

                  // Merge ingredients — combine same name+unit, multiply by recipe count
                  const merged = new Map<string, { name: string; amount: number; unit: string; from: Set<string> }>();
                  for (const ing of ingredients) {
                    const key = `${(ing.name ?? "").toLowerCase().trim()}|${(ing.unit ?? "").toLowerCase().trim()}`;
                    const multiplier = recipeCounts[ing.recipe_id] ?? 1;
                    const existing = merged.get(key);
                    if (existing) {
                      existing.amount += (ing.amount ?? 1) * multiplier;
                      existing.from.add(recipeTitles[ing.recipe_id] ?? "");
                    } else {
                      merged.set(key, {
                        name: ing.name ?? "Unknown",
                        amount: (ing.amount ?? 1) * multiplier,
                        unit: ing.unit ?? "",
                        from: new Set([recipeTitles[ing.recipe_id] ?? ""]),
                      });
                    }
                  }

                  // Categorise simply by name heuristics
                  const categorise = (name: string): string => {
                    const n = name.toLowerCase();
                    if (/chicken|beef|pork|lamb|turkey|fish|salmon|prawn|shrimp|bacon|ham|sausage|mince/.test(n)) return "Meat & Fish";
                    if (/milk|cream|cheese|yoghurt|yogurt|butter|egg/.test(n)) return "Dairy & Eggs";
                    if (/bread|flour|pasta|rice|noodle|oat|cereal/.test(n)) return "Carbs & Grains";
                    if (/oil|vinegar|sauce|mustard|ketchup|soy|stock|honey|sugar|salt|pepper|spice|cumin|paprika|cinnamon/.test(n)) return "Pantry";
                    return "Fruit & Veg";
                  };

                  const items = [...merged.values()].map((item, i) => ({
                    id: String(i),
                    name: item.name,
                    amount: item.amount % 1 === 0 ? String(item.amount) : item.amount.toFixed(1),
                    unit: item.unit,
                    category: categorise(item.name),
                    checked: false,
                    from: [...item.from].filter(Boolean).join(", "),
                  }));

                  // Sort by category
                  items.sort((a, b) => a.category.localeCompare(b.category));

                  await supabase
                    .from("shopping_lists")
                    .upsert({ user_id: userId, items, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

                  setGenerating(false);
                  router.push("/shopping");
                } catch {
                  setGenerating(false);
                  Alert.alert("Error", "Failed to generate shopping list.");
                }
              }}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.generateBtnText}>Generate Shopping List</Text>
              )}
            </Pressable>
            <Pressable style={styles.regenBtn} onPress={() => setPlan(null)}>
              <Text style={styles.regenBtnText}>New Plan</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
