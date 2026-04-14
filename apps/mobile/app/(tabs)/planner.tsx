import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { useDiscoverRecipes, useSavedLibraryRecipes } from "@/lib/recipes";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate, newMealId } from "@/lib/nutritionJournal";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
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
  const [userTier, setUserTier] = useState<"free" | "base" | "pro">("free");

  // Load user tier — default to "pro" if column is null (graceful for existing users)
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("user_tier")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        const tier = data?.user_tier as string | null;
        if (tier === "free" || tier === "base" || tier === "pro") {
          setUserTier(tier);
        } else {
          // If null/unset, treat as pro (existing users before tier was added)
          setUserTier("pro");
        }
      });
  }, [userId]);

  const isFree = userTier === "free";
  const [planTargets, setPlanTargets] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [enabledSlots, setEnabledSlots] = useState<Set<string>>(new Set(ALL_MEAL_SLOTS));
  const [shoppingItemCount, setShoppingItemCount] = useState(0);

  // Load shopping item count
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("shopping_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(({ count }) => {
        setShoppingItemCount(count ?? 0);
      });
  }, [userId, plan]);

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

  // Get date range for header (assuming plan starts today)
  const getDateRange = useCallback(() => {
    const today = new Date();
    const start = today.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!plan || plan.length <= 1) return start;
    const end = new Date(today);
    end.setDate(end.getDate() + plan.length - 1);
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${start} – ${endStr}`;
  }, [plan]);

  // Helper to truncate meal names in day cards
  const truncateMealName = (name: string, maxLen: number = 12) => {
    return name.length > maxLen ? name.substring(0, maxLen - 1) + "…" : name;
  };

  // Determine progress bar color based on calorie percentage vs target
  const getProgressColor = (cals: number, target: number) => {
    const pct = target > 0 ? (cals / target) * 100 : 0;
    if (pct >= 90) return Accent.success;
    if (pct >= 50) return Accent.warning;
    return colors.border;
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 120, gap: Spacing.lg },
        headerTitle: {
          fontSize: 22,
          fontWeight: "700",
          color: colors.text,
          letterSpacing: -0.4,
          paddingTop: 18,
          paddingBottom: 4,
        },
        headerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: Spacing.md,
          marginBottom: Spacing.md,
        },
        headerLeft: { flex: 1 },
        headerSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
        autoFillBtn: {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: Accent.primary,
          flexDirection: "row",
          gap: 4,
          alignItems: "center",
        },
        autoFillBtnText: { fontSize: 13, fontWeight: "600", color: Accent.primary },

        dayCardsScroll: { marginHorizontal: -Spacing.xl, paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg, gap: 8 },
        dayCard: {
          width: 110,
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.sm,
          alignItems: "center",
          gap: Spacing.xs,
        },
        dayCardToday: { borderColor: Accent.primary, backgroundColor: Accent.primary + "08" },
        dayCardName: { fontSize: 13, fontWeight: "600", color: colors.text },
        dayCardNameToday: { color: Accent.primary },
        dayCardMeals: { gap: 2 },
        dayCardMeal: { fontSize: 10, color: colors.textTertiary, lineHeight: 12 },
        dayCardProgressBar: { width: "100%", height: 3, backgroundColor: colors.border, borderRadius: 1.5, marginVertical: Spacing.xs },
        dayCardProgressFill: { height: 3, borderRadius: 1.5 },
        dayCardCalories: { fontSize: 10, color: colors.textTertiary, fontVariant: ["tabular-nums"] },

        sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.5, marginTop: Spacing.md },

        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          gap: Spacing.md,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
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
        dayBtnActive: { borderColor: Accent.primary, backgroundColor: Accent.primary + "15" },
        dayBtnText: { color: colors.textTertiary, fontWeight: "600", fontSize: 14 },
        dayBtnTextActive: { color: Accent.primary },

        generateBtn: {
          backgroundColor: Accent.primary,
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
        mealSlot: { fontSize: 11, fontWeight: "700", color: Accent.primary, letterSpacing: 1 },
        mealTitle: { fontSize: 15, fontWeight: "500", color: colors.text, marginTop: 2 },
        mealMacros: { fontSize: 11, color: colors.textTertiary, marginTop: 2, fontVariant: ["tabular-nums"] },
        mealChevron: { color: colors.tabIconDefault, fontSize: 22, fontWeight: "600" },

        shoppingListCard: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          gap: Spacing.md,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
        shoppingListIcon: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Accent.warning + "15", alignItems: "center", justifyContent: "center", marginRight: Spacing.md },
        shoppingListContent: { flex: 1 },
        shoppingListTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
        shoppingListSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

        actionsRow: { gap: Spacing.md },
        regenBtn: {
          borderWidth: 1,
          borderColor: Accent.primary + "50",
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
        },
        regenBtnText: { color: Accent.primary, fontWeight: "700", fontSize: 15 },
      }),
    [colors],
  );

  // Load existing plan from DB — try relational first, fall back to legacy JSONB
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      // Try relational tables
      const { data: dayRows, error: dayErr } = await supabase
        .from("meal_plan_days")
        .select("id, day")
        .eq("user_id", userId)
        .eq("slot_id", "default")
        .order("day", { ascending: true });

      if (!cancelled && dayRows && dayRows.length > 0 && !dayErr) {
        const dayIds = dayRows.map((d: { id: string }) => d.id);
        const { data: mealRows } = await supabase
          .from("meal_plan_meals")
          .select("plan_day_id, slot_index, name, recipe_title, calories, protein, carbs, fat, portion_multiplier, is_placeholder")
          .in("plan_day_id", dayIds)
          .order("slot_index", { ascending: true });

        if (!cancelled && mealRows) {
          const mealsByDay = new Map<string, typeof mealRows>();
          for (const m of mealRows) {
            const arr = mealsByDay.get(m.plan_day_id as string) ?? [];
            arr.push(m);
            mealsByDay.set(m.plan_day_id as string, arr);
          }
          const plans: DayPlan[] = dayRows.map((d: { id: string; day: number }) => {
            const meals = (mealsByDay.get(d.id) ?? []).map((m) => ({
              name: (m.name as string) ?? "",
              recipeTitle: (m.recipe_title as string) ?? "",
              calories: (m.calories as number) ?? 0,
              protein: (m.protein as number) ?? 0,
              carbs: (m.carbs as number) ?? 0,
              fat: (m.fat as number) ?? 0,
              portionMultiplier: (m.portion_multiplier as number) ?? 1,
              isPlaceholder: (m.is_placeholder as boolean) || undefined,
            }));
            const totals = meals.reduce(
              (acc, ml) => ml.isPlaceholder ? acc : ({
                calories: acc.calories + ml.calories,
                protein: acc.protein + ml.protein,
                carbs: acc.carbs + ml.carbs,
                fat: acc.fat + ml.fat,
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 },
            );
            return { day: d.day, meals, totals };
          });
          setPlan(plans);
          return;
        }
      }

      // Fall back to legacy JSONB
      if (!cancelled) {
        const { data } = await supabase
          .from("meal_plans")
          .select("plan")
          .eq("user_id", userId)
          .maybeSingle();
        if (!cancelled && data?.plan && Array.isArray(data.plan)) {
          setPlan(data.plan as DayPlan[]);
        }
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
      let profileCals = NUTRITION_DEFAULTS.calories;
      let profilePro = NUTRITION_DEFAULTS.protein;
      let profileCarbs = NUTRITION_DEFAULTS.carbs;
      let profileFat = NUTRITION_DEFAULTS.fat;
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

      // Persist — relational tables with legacy fallback
      if (userId) {
        (async () => {
          // Delete existing then re-insert
          const { error: delErr } = await supabase
            .from("meal_plan_days")
            .delete()
            .eq("user_id", userId)
            .eq("slot_id", "default");

          if (delErr) {
            // Fall back to legacy JSONB
            void supabase
              .from("meal_plans")
              .upsert({ user_id: userId, plan: newPlan, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
            return;
          }

          for (const dp of newPlan) {
            const { data: dayRow } = await supabase
              .from("meal_plan_days")
              .insert({ user_id: userId, slot_id: "default", day: dp.day })
              .select("id")
              .single();
            if (!dayRow) continue;
            const mealInserts = dp.meals.map((m, idx) => ({
              plan_day_id: dayRow.id,
              slot_index: idx,
              name: m.name,
              recipe_title: m.recipeTitle,
              calories: m.calories,
              protein: m.protein,
              carbs: m.carbs,
              fat: m.fat,
              portion_multiplier: m.portionMultiplier ?? 1,
              is_placeholder: m.isPlaceholder ?? false,
            }));
            if (mealInserts.length > 0) {
              await supabase.from("meal_plan_meals").insert(mealInserts);
            }
          }
        })();
      }
    }
  }, [savedRecipes, days, userId, enabledSlots]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header with title, date range, and AI Auto-fill button */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Meal Plan</Text>
            {plan && <Text style={styles.headerSubtitle}>{getDateRange()}</Text>}
          </View>
          <Pressable style={styles.autoFillBtn} onPress={generatePlan} disabled={generating || !plan}>
            <Ionicons name="sparkles" size={14} color={Accent.primary} />
            <Text style={styles.autoFillBtnText}>AI Auto-fill</Text>
          </Pressable>
        </View>

        {/* Horizontal scrollable day cards (when plan exists) */}
        {plan && plan.length > 0 && planTargets && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayCardsScroll}
            scrollEventThrottle={16}
          >
            {plan.map((dp, idx) => {
              const isToday = idx === 0;
              const progressColor = getProgressColor(dp.totals.calories, planTargets.calories);
              const progressPct = planTargets.calories > 0 ? (dp.totals.calories / planTargets.calories) * 100 : 0;
              return (
                <View key={dp.day} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                  <Text style={[styles.dayCardName, isToday && styles.dayCardNameToday]}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(new Date().setDate(new Date().getDate() + idx)).getDay()]}
                  </Text>
                  <View style={styles.dayCardMeals}>
                    {dp.meals.map((m, mi) => (
                      <Text key={mi} style={styles.dayCardMeal} numberOfLines={1}>
                        {truncateMealName(m.name)}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.dayCardProgressBar}>
                    <View
                      style={[
                        styles.dayCardProgressFill,
                        { width: `${Math.min(progressPct, 100)}%`, backgroundColor: progressColor },
                      ]}
                    />
                  </View>
                  <Text style={styles.dayCardCalories}>
                    {Math.round(dp.totals.calories)} / {Math.round(planTargets.calories)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Generate controls */}
        {!plan && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plan your week</Text>
            <Text style={styles.cardDesc}>
              {savedRecipes.length} recipe{savedRecipes.length !== 1 ? "s" : ""} in your library.
              {savedRecipes.length === 0 ? " Save some from Discover first." : ""}
            </Text>

            <View style={styles.daysRow}>
              {([1, 3, 7] as const).map((d) => {
                const locked = isFree && d > 1;
                return (
                  <Pressable
                    key={d}
                    style={[styles.dayBtn, days === d && styles.dayBtnActive, locked && { opacity: 0.5 }]}
                    onPress={() => {
                      if (locked) {
                        Alert.alert("Upgrade required", "Multi-day plans are available on Base and Pro plans.");
                        return;
                      }
                      setDays(d);
                    }}
                  >
                    <Text style={[styles.dayBtnText, days === d && styles.dayBtnTextActive]}>
                      {d} day{d > 1 ? "s" : ""}{locked ? " 🔒" : ""}
                    </Text>
                  </Pressable>
                );
              })}
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

        {/* Today's plan section label */}
        {plan && plan.length > 0 && (
          <Text style={styles.sectionLabel}>
            {`${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()]}'s plan`}
          </Text>
        )}

        {/* Plan display */}
        {plan && plan.map((dp, dayIdx) => (
          <View key={dp.day} style={styles.card}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>Day {dp.day}</Text>
              <Text style={styles.dayTotals}>{Math.round(dp.totals.calories)} kcal</Text>
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
                      <Text style={{ fontSize: 10, color: isClose ? Accent.success : diff > 0 ? Accent.destructive : Accent.warning }}>
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
                    {Math.round(meal.calories)} kcal · P {Math.round(meal.protein)}g · C {Math.round(meal.carbs)}g · F {Math.round(meal.fat)}g
                  </Text>
                </View>
                {/* Log to tracker */}
                <Pressable
                  hitSlop={8}
                  onPress={async (e) => {
                    e.stopPropagation?.();
                    const dk = dateKeyFromDate(new Date());
                    const entryId = newMealId();
                    const { error } = await supabase
                      .from("nutrition_entries")
                      .insert({
                        id: entryId,
                        user_id: userId,
                        date_key: dk,
                        name: meal.name,
                        recipe_title: meal.recipeTitle,
                        time_label: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                        calories: meal.calories,
                        protein: meal.protein,
                        carbs: meal.carbs,
                        fat: meal.fat,
                        portion_multiplier: meal.portionMultiplier ?? 1,
                      });
                    if (error) {
                      console.error("[planner] log entry failed:", error.message);
                      Alert.alert("Log failed", "Could not save to tracker. " + error.message);
                    } else {
                      Alert.alert("Logged", `${meal.recipeTitle} added to today's tracker.`);
                    }
                  }}
                  style={{ paddingHorizontal: 8, paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.primary }}>Log{"\n"}today</Text>
                </Pressable>
                <Text style={styles.mealChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ))}

        {/* Shopping list CTA */}
        {plan && (
          <Pressable
            style={styles.shoppingListCard}
            onPress={() => router.push("/shopping")}
          >
            <View style={styles.shoppingListIcon}>
              <Ionicons name="cart" size={24} color={Accent.warning} />
            </View>
            <View style={styles.shoppingListContent}>
              <Text style={styles.shoppingListTitle}>Shopping List</Text>
              <Text style={styles.shoppingListSubtitle}>{shoppingItemCount > 0 ? `${shoppingItemCount} item${shoppingItemCount !== 1 ? "s" : ""} from this week` : "Generate a list from your plan"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
        )}

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

                  // Try relational table, fall back to legacy
                  const inserts = items.map((item) => ({
                    id: item.id,
                    user_id: userId,
                    name: item.name,
                    amount: item.amount,
                    unit: item.unit,
                    category: item.category,
                    checked: item.checked,
                    source: item.from,
                  }));
                  // Clear existing then insert
                  const { error: delErr } = await supabase.from("shopping_items").delete().eq("user_id", userId!);
                  if (delErr) {
                    await supabase
                      .from("shopping_lists")
                      .upsert({ user_id: userId, items, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
                  } else if (inserts.length > 0) {
                    await supabase.from("shopping_items").insert(inserts);
                  }

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
