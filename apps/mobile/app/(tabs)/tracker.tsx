import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { dateKeyFromDate, newMealId, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { MacroColors, Neon, Spacing, Radius } from "@/constants/theme";
import FoodSearchModal from "@/components/FoodSearchModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import { lookupBarcode } from "@/lib/verifyRecipe";

const DEFAULT_TARGETS = { calories: 2000, protein: 150, carbs: 200, fat: 65 };

function todayKey(): string {
  return dateKeyFromDate(new Date());
}

export default function TrackerScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const colors = useThemeColors();

  const [byDay, setByDay] = useState<ByDay>({});
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileTargets, setProfileTargets] = useState(DEFAULT_TARGETS);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [activeMealSlot, setActiveMealSlot] = useState("Breakfast");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

  // Recent unique meals from all days for "Add previous meal"
  const recentMeals = useMemo(() => {
    const seen = new Set<string>();
    const recent: JournalMeal[] = [];
    const allDayKeys = Object.keys(byDay).sort().reverse();
    for (const dk of allDayKeys) {
      for (const m of (byDay[dk] ?? []).slice().reverse()) {
        const key = `${m.recipeTitle}|${m.calories}`;
        if (seen.has(key)) continue;
        seen.add(key);
        recent.push(m);
        if (recent.length >= 20) break;
      }
      if (recent.length >= 20) break;
    }
    return recent;
  }, [byDay]);

  // Load targets from user profile
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("target_calories, target_protein, target_carbs, target_fat")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfileTargets({
            calories: data.target_calories ?? DEFAULT_TARGETS.calories,
            protein: data.target_protein ?? DEFAULT_TARGETS.protein,
            carbs: data.target_carbs ?? DEFAULT_TARGETS.carbs,
            fat: data.target_fat ?? DEFAULT_TARGETS.fat,
          });
        }
      });
  }, [userId]);

  const dayKey = dateKeyFromDate(selectedDate);
  const mealsToday = byDay[dayKey] ?? [];
  const targets = profileTargets;
  const isToday = dayKey === dateKeyFromDate(new Date());

  const navigateDay = useCallback((offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset);
      return next;
    });
  }, []);

  const formatDateLabel = useCallback((d: Date) => {
    const today = new Date();
    const todayStr = dateKeyFromDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dk = dateKeyFromDate(d);
    if (dk === todayStr) return "Today";
    if (dk === dateKeyFromDate(yesterday)) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }, []);

  // Week data: Mon-Sun for the selected date's week
  const weekData = useMemo(() => {
    const d = new Date(selectedDate);
    const dayOfWeek = d.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);

    const days: { key: string; label: string; short: string; date: Date; meals: JournalMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } }[] = [];
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      const dk = dateKeyFromDate(dd);
      const meals = byDay[dk] ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + Math.max(0, m.calories),
          protein: acc.protein + Math.max(0, m.protein),
          carbs: acc.carbs + Math.max(0, m.carbs),
          fat: acc.fat + Math.max(0, m.fat),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      days.push({ key: dk, label: dayLabels[i], short: dayLabels[i], date: dd, meals, totals });
    }

    const weekTotals = days.reduce(
      (acc, d) => ({
        calories: acc.calories + d.totals.calories,
        protein: acc.protein + d.totals.protein,
        carbs: acc.carbs + d.totals.carbs,
        fat: acc.fat + d.totals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const daysWithFood = days.filter((d) => d.totals.calories > 0).length || 1;
    const weekAvg = {
      calories: Math.round(weekTotals.calories / daysWithFood),
      protein: Math.round(weekTotals.protein / daysWithFood),
      carbs: Math.round(weekTotals.carbs / daysWithFood),
      fat: Math.round(weekTotals.fat / daysWithFood),
    };

    const weekStart = monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekEnd = sunday.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return { days, weekTotals, weekAvg, daysWithFood, label: `${weekStart} – ${weekEnd}` };
  }, [selectedDate, byDay]);

  const navigateWeek = useCallback((offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset * 7);
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    return mealsToday.reduce(
      (acc, m) => ({
        calories: acc.calories + Math.max(0, m.calories),
        protein: acc.protein + Math.max(0, m.protein),
        carbs: acc.carbs + Math.max(0, m.carbs),
        fat: acc.fat + Math.max(0, m.fat),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [mealsToday]);

  const remaining = targets.calories - totals.calories;
  const isOver = remaining < 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 120, gap: Spacing.lg },

        header: { alignItems: "center", paddingVertical: Spacing.md },
        headerTitle: {
          fontSize: 22,
          fontWeight: "800",
          color: Neon.purple,
          letterSpacing: 3,
        },

        dateNav: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.xl,
        },
        dateNavArrow: { color: colors.textSecondary, fontSize: 22, fontWeight: "600" },
        dateNavLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },

        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Neon.pink + "30",
          padding: Spacing.xl,
          gap: Spacing.md,
        },
        cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },

        calorieSummary: { gap: Spacing.lg },
        calorieHero: { alignItems: "center" },
        calorieHeroNumber: {
          fontSize: 44,
          fontWeight: "800",
          color: colors.text,
          fontVariant: ["tabular-nums"],
        },
        calorieHeroLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, letterSpacing: 1, marginTop: 4 },
        calorieBarBlock: { gap: Spacing.sm },
        calorieBarLabels: { flexDirection: "row", justifyContent: "space-between" },
        calorieBarMuted: { fontSize: 12, color: colors.textTertiary, fontVariant: ["tabular-nums"] },
        calorieBarTrack: {
          height: 10,
          backgroundColor: colors.border,
          borderRadius: 5,
          overflow: "hidden",
        },
        calorieBarFill: { height: 10, borderRadius: 5, backgroundColor: Neon.purple },

        macroBarBlock: { gap: Spacing.xs, paddingVertical: Spacing.sm },
        macroBarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
        macroBarTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
        macroBarNums: { fontSize: 12, color: colors.textTertiary, fontVariant: ["tabular-nums"] },
        macroBarTrack: {
          height: 8,
          backgroundColor: colors.border,
          borderRadius: 4,
          overflow: "hidden",
        },
        macroBarFill: { height: 8, borderRadius: 4 },

        // Calorie math
        calorieMathRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.md,
        },
        calorieMathItem: { alignItems: "center" },
        calorieMathNumber: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
        calorieMathLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
        calorieMathOp: { fontSize: 18, color: colors.textTertiary, fontWeight: "600" },

        // Meal sections
        mealSlotHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        mealSlotName: { fontSize: 18, fontWeight: "700", color: colors.text },
        mealSlotCals: { fontSize: 18, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
        mealSlotMacros: { fontSize: 12, color: colors.textSecondary },
        mealRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        mealName: { fontSize: 15, fontWeight: "500", color: colors.text },
        mealMeta: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
        mealCals: { fontSize: 16, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },

        addFoodBtn: {
          borderWidth: 1,
          borderColor: Neon.purple + "60",
          borderRadius: Radius.md,
          paddingVertical: Spacing.md,
          alignItems: "center",
        },
        addFoodBtnText: { color: Neon.purple, fontWeight: "700", letterSpacing: 1, fontSize: 13 },

        emptyText: { color: colors.textTertiary, textAlign: "center", fontSize: 14 },

        // Add food form
        input: {
          backgroundColor: colors.inputBg,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          color: colors.text,
          fontSize: 15,
        },
        inputRow: { flexDirection: "row", gap: Spacing.sm },
        submitBtn: {
          backgroundColor: Neon.purple,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
        },
        submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

        floatingAdd: {
          backgroundColor: Neon.purple,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
        },
        floatingAddText: { color: "#fff", fontWeight: "700", fontSize: 16 },
      }),
    [colors],
  );

  // Load journal
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("nutrition_journals")
        .select("by_day")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[tracker] journal load failed:", error.message);
        // Still hydrate so UI isn't stuck loading — user can log new meals
      } else if (data?.by_day && typeof data.by_day === "object") {
        setByDay(data.by_day as ByDay);
      }
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Sync journal
  useEffect(() => {
    if (!userId || !hydrated) return;
    const t = setTimeout(() => {
      void supabase
        .from("nutrition_journals")
        .upsert(
          { user_id: userId, updated_at: new Date().toISOString(), by_day: byDay },
          { onConflict: "user_id" },
        );
    }, 600);
    return () => clearTimeout(t);
  }, [userId, hydrated, byDay]);

  const addMeal = useCallback(() => {
    const cal = Number(kcal) || 0;
    const p = Number(protein) || 0;
    const cb = Number(carbs) || 0;
    const f = Number(fat) || 0;
    if (cal <= 0) return;

    const meal: JournalMeal = {
      id: newMealId(),
      name: activeMealSlot,
      recipeTitle: title.trim() || "Quick entry",
      time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      calories: Math.round(cal),
      protein: Math.round(p),
      carbs: Math.round(cb),
      fat: Math.round(f),
    };
    setByDay((prev) => ({
      ...prev,
      [dayKey]: [...(prev[dayKey] ?? []), meal],
    }));
    setTitle("");
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
    setAddOpen(false);
  }, [dayKey, kcal, protein, carbs, fat, title, activeMealSlot]);

  const deleteMeal = useCallback((mealId: string) => {
    setByDay((prev) => ({
      ...prev,
      [dayKey]: (prev[dayKey] ?? []).filter((m) => m.id !== mealId),
    }));
  }, [dayKey]);

  // Group meals by slot
  const mealGroups = useMemo(() => {
    const groups: Record<string, JournalMeal[]> = {};
    for (const m of mealsToday) {
      const slot = m.name || "Other";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(m);
    }
    return groups;
  }, [mealsToday]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PLATEMATE</Text>
        </View>

        {/* Day/Week toggle */}
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: Radius.md, padding: 3 }}>
          <Pressable
            onPress={() => setViewMode("day")}
            style={{ flex: 1, paddingVertical: 10, borderRadius: Radius.sm, backgroundColor: viewMode === "day" ? Neon.purple : "transparent", alignItems: "center" }}
          >
            <Text style={{ color: viewMode === "day" ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 14 }}>Day</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode("week")}
            style={{ flex: 1, paddingVertical: 10, borderRadius: Radius.sm, backgroundColor: viewMode === "week" ? Neon.purple : "transparent", alignItems: "center" }}
          >
            <Text style={{ color: viewMode === "week" ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 14 }}>Week</Text>
          </Pressable>
        </View>

        {/* Date nav */}
        <View style={styles.dateNav}>
          <Pressable onPress={() => viewMode === "day" ? navigateDay(-1) : navigateWeek(-1)} hitSlop={12}>
            <Text style={styles.dateNavArrow}>‹</Text>
          </Pressable>
          <Pressable onPress={() => { setSelectedDate(new Date()); }} hitSlop={12}>
            <Text style={styles.dateNavLabel}>
              {viewMode === "day" ? formatDateLabel(selectedDate) : weekData.label}
            </Text>
          </Pressable>
          <Pressable onPress={() => viewMode === "day" ? navigateDay(1) : navigateWeek(1)} hitSlop={12}>
            <Text style={styles.dateNavArrow}>›</Text>
          </Pressable>
        </View>

        {viewMode === "week" ? (
          <>
            {/* Weekly bar chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Calories</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 140, marginTop: Spacing.md }}>
                {weekData.days.map((day) => {
                  const maxCal = Math.max(targets.calories, ...weekData.days.map((d) => d.totals.calories));
                  const barHeight = maxCal > 0 ? Math.max(4, (day.totals.calories / maxCal) * 110) : 4;
                  const over = day.totals.calories > targets.calories;
                  const todayDk = dateKeyFromDate(new Date());
                  const isCurrentDay = day.key === todayDk;
                  return (
                    <Pressable
                      key={day.key}
                      onPress={() => { setSelectedDate(day.date); setViewMode("day"); }}
                      style={{ alignItems: "center", flex: 1, gap: 4 }}
                    >
                      <Text style={{ fontSize: 10, color: colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                        {day.totals.calories > 0 ? day.totals.calories : ""}
                      </Text>
                      <View
                        style={{
                          width: 28,
                          height: barHeight,
                          borderRadius: 4,
                          backgroundColor: over ? Neon.red + "CC" : day.totals.calories > 0 ? Neon.purple : colors.border,
                        }}
                      />
                      <Text style={{
                        fontSize: 11,
                        fontWeight: isCurrentDay ? "800" : "600",
                        color: isCurrentDay ? Neon.purple : colors.textSecondary,
                      }}>
                        {day.short}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* Goal line label */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>Daily goal: {targets.calories} kcal</Text>
              </View>
            </View>

            {/* Weekly summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Summary</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: Spacing.md }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>{weekData.weekTotals.calories}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Total kcal</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: Neon.purple, fontVariant: ["tabular-nums"] }}>{weekData.weekAvg.calories}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Daily avg</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: targets.calories * 7 > weekData.weekTotals.calories ? Neon.green : Neon.red, fontVariant: ["tabular-nums"] }}>
                    {Math.abs(targets.calories * 7 - weekData.weekTotals.calories)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {targets.calories * 7 > weekData.weekTotals.calories ? "Under budget" : "Over budget"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weekly macro averages */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Averages</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: Spacing.sm }}>
                Based on {weekData.daysWithFood} day{weekData.daysWithFood !== 1 ? "s" : ""} with logged food
              </Text>
              <MacroBarRow label="PROTEIN" current={weekData.weekAvg.protein} goal={targets.protein} color={MacroColors.protein} styles={styles} />
              <MacroBarRow label="CARBS" current={weekData.weekAvg.carbs} goal={targets.carbs} color={MacroColors.carbs} styles={styles} />
              <MacroBarRow label="FATS" current={weekData.weekAvg.fat} goal={targets.fat} color={MacroColors.fat} styles={styles} />
            </View>

            {/* Macro bars per day */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Macro Breakdown</Text>
              <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                {weekData.days.map((day) => (
                  <Pressable
                    key={day.key}
                    onPress={() => { setSelectedDate(day.date); setViewMode("day"); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
                  >
                    <Text style={{ width: 30, fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>{day.short}</Text>
                    <View style={{ flex: 1, flexDirection: "row", height: 14, borderRadius: 3, overflow: "hidden", backgroundColor: colors.border }}>
                      {day.totals.calories > 0 && (() => {
                        const total = day.totals.protein + day.totals.carbs + day.totals.fat || 1;
                        return (
                          <>
                            <View style={{ width: `${(day.totals.protein / total) * 100}%`, backgroundColor: MacroColors.protein }} />
                            <View style={{ width: `${(day.totals.carbs / total) * 100}%`, backgroundColor: MacroColors.carbs }} />
                            <View style={{ width: `${(day.totals.fat / total) * 100}%`, backgroundColor: MacroColors.fat }} />
                          </>
                        );
                      })()}
                    </View>
                    <Text style={{ width: 45, fontSize: 11, color: colors.textTertiary, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                      {day.totals.calories > 0 ? `${day.totals.calories}` : "—"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.lg, justifyContent: "center", marginTop: Spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.protein }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Protein</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.carbs }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Carbs</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MacroColors.fat }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Fat</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Calories */}
            <View style={styles.card}>
              <CalorieSummary consumed={totals.calories} goal={targets.calories} remaining={remaining} styles={styles} />
            </View>

            {/* Macros */}
            <View style={styles.card}>
              <MacroBarRow label="PROTEIN" current={totals.protein} goal={targets.protein} color={MacroColors.protein} styles={styles} />
              <MacroBarRow label="CARBS" current={totals.carbs} goal={targets.carbs} color={MacroColors.carbs} styles={styles} />
              <MacroBarRow label="FATS" current={totals.fat} goal={targets.fat} color={MacroColors.fat} styles={styles} />
            </View>

            {/* Calorie math */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Calories Remaining</Text>
              <View style={styles.calorieMathRow}>
                <View style={styles.calorieMathItem}>
                  <Text style={[styles.calorieMathNumber, { color: Neon.green }]}>{targets.calories}</Text>
                  <Text style={styles.calorieMathLabel}>Base</Text>
                </View>
                <Text style={styles.calorieMathOp}>−</Text>
                <View style={styles.calorieMathItem}>
                  <Text style={[styles.calorieMathNumber, { color: Neon.yellow }]}>{totals.calories}</Text>
                  <Text style={styles.calorieMathLabel}>Food</Text>
                </View>
                <Text style={styles.calorieMathOp}>=</Text>
                <View style={styles.calorieMathItem}>
                  <Text style={[styles.calorieMathNumber, { color: isOver ? Neon.red : Neon.cyan }]}>{isOver ? `+${Math.abs(remaining)}` : remaining}</Text>
                  <Text style={styles.calorieMathLabel}>{isOver ? "Over" : "Remaining"}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Meal sections (day view only) — show all slots */}
        {viewMode === "day" && MEAL_SLOTS.map((slot) => {
          const meals = mealGroups[slot] ?? [];
          const slotCals = meals.reduce((a, m) => a + m.calories, 0);
          const slotP = meals.reduce((a, m) => a + m.protein, 0);
          const slotC = meals.reduce((a, m) => a + m.carbs, 0);
          const slotF = meals.reduce((a, m) => a + m.fat, 0);
          return (
            <View key={slot} style={styles.card}>
              <View style={styles.mealSlotHeader}>
                <Text style={styles.mealSlotName}>{slot}</Text>
                {slotCals > 0 && <Text style={styles.mealSlotCals}>{slotCals}</Text>}
              </View>
              {slotCals > 0 && (
                <Text style={styles.mealSlotMacros}>
                  P {slotP}g · C {slotC}g · F {slotF}g
                </Text>
              )}
              {meals.map((m) => (
                <Pressable
                  key={m.id}
                  style={styles.mealRow}
                  onLongPress={() => {
                    Alert.alert("Delete entry", `Remove "${m.recipeTitle}"?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteMeal(m.id) },
                    ]);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealName}>{m.recipeTitle}</Text>
                    <Text style={styles.mealMeta}>P {m.protein}g · C {m.carbs}g · F {m.fat}g</Text>
                  </View>
                  <Text style={styles.mealCals}>{m.calories}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.addFoodBtn} onPress={() => { setActiveMealSlot(slot); setAddOpen(true); }}>
                <Text style={styles.addFoodBtnText}>ADD FOOD</Text>
              </Pressable>
            </View>
          );
        })}

        {/* Add food form */}
        {viewMode === "day" && addOpen && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Log to {activeMealSlot}</Text>
            {/* Meal slot quick-switch */}
            <View style={{ flexDirection: "row", gap: Spacing.xs }}>
              {MEAL_SLOTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setActiveMealSlot(s)}
                  style={{
                    flex: 1, paddingVertical: 6, borderRadius: Radius.sm, alignItems: "center",
                    backgroundColor: activeMealSlot === s ? Neon.purple : colors.border + "40",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: activeMealSlot === s ? "#fff" : colors.textSecondary }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholder="Food name"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <View style={styles.inputRow}>
              <TextInput
                placeholder="Calories"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={kcal}
                onChangeText={setKcal}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                placeholder="Protein"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={protein}
                onChangeText={setProtein}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                placeholder="Carbs"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={carbs}
                onChangeText={setCarbs}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                placeholder="Fat"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={fat}
                onChangeText={setFat}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <Pressable style={[styles.submitBtn, { flex: 1 }]} onPress={addMeal}>
                <Text style={styles.submitBtnText}>Add to Today</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, { flex: 1, backgroundColor: Neon.purple }]}
                onPress={() => { setAddOpen(false); setSearchOpen(true); }}
              >
                <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.submitBtnText}>Search</Text>
              </Pressable>
            </View>
          </View>
        )}

        {viewMode === "day" && !addOpen && !showPrevious && mealsToday.length > 0 && (
          <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <Pressable style={[styles.floatingAdd, { flex: 1 }]} onPress={() => setAddOpen(true)}>
                <Text style={styles.floatingAddText}>+ Quick Add</Text>
              </Pressable>
              <Pressable style={[styles.floatingAdd, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: Neon.purple + "50" }]} onPress={() => setSearchOpen(true)}>
                <Ionicons name="search" size={14} color={Neon.purple} />
                <Text style={[styles.floatingAddText, { color: Neon.purple }]}> Search</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <Pressable style={[styles.floatingAdd, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: Neon.purple + "50" }]} onPress={() => setBarcodeOpen(true)}>
                <Ionicons name="barcode-outline" size={16} color={Neon.purple} />
                <Text style={[styles.floatingAddText, { color: Neon.purple }]}> Scan</Text>
              </Pressable>
              <Pressable style={[styles.floatingAdd, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: Neon.purple + "50" }]} onPress={() => setShowPrevious(true)}>
                <Ionicons name="time-outline" size={16} color={Neon.purple} />
                <Text style={[styles.floatingAddText, { color: Neon.purple }]}> Previous</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Food search modal for logging */}
      <FoodSearchModal
        visible={searchOpen}
        initialQuery=""
        onSelect={(result: any) => {
          const grams = result.chosenPortion.gramWeight * result.quantity;
          const f = grams / 100;
          const meal: JournalMeal = {
            id: newMealId(),
            name: activeMealSlot,
            recipeTitle: result.name,
            time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
            calories: Math.round(result.macrosPer100g.calories * f),
            protein: Math.round(result.macrosPer100g.protein * f * 10) / 10,
            carbs: Math.round(result.macrosPer100g.carbs * f * 10) / 10,
            fat: Math.round(result.macrosPer100g.fat * f * 10) / 10,
          };
          setByDay((prev) => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] ?? []), meal],
          }));
          setSearchOpen(false);
        }}
        onClose={() => setSearchOpen(false)}
      />

      {/* Barcode scanner */}
      <BarcodeScannerModal
        visible={barcodeOpen}
        onScan={async (code: string) => {
          const product = await lookupBarcode(code);
          setBarcodeOpen(false);
          if (!product) {
            Alert.alert("Not found", "Couldn't find nutrition data for this barcode.");
            return;
          }
          const meal: JournalMeal = {
            id: newMealId(),
            name: activeMealSlot,
            recipeTitle: product.name,
            time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
            calories: product.calories,
            protein: product.protein,
            carbs: product.carbs,
            fat: product.fat,
          };
          setByDay((prev) => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] ?? []), meal],
          }));
          Alert.alert("Logged", `${product.name} added to ${activeMealSlot}.`);
        }}
        onClose={() => setBarcodeOpen(false)}
      />

      {/* Previous meals panel */}
      {showPrevious && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0, top: 0,
          backgroundColor: colors.background, paddingTop: insets.top,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Previous Meals</Text>
            <Pressable onPress={() => setShowPrevious(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: 40, gap: Spacing.sm }}>
            {recentMeals.length === 0 && (
              <Text style={{ color: colors.textSecondary, textAlign: "center", paddingTop: 40 }}>
                No previous meals to show. Start logging to build your history.
              </Text>
            )}
            {recentMeals.map((m, idx) => (
              <Pressable
                key={`${m.recipeTitle}-${idx}`}
                style={{
                  backgroundColor: colors.card, borderRadius: Radius.md,
                  padding: Spacing.md, flexDirection: "row", alignItems: "center",
                  borderWidth: 1, borderColor: colors.border,
                }}
                onPress={() => {
                  const meal: JournalMeal = {
                    id: newMealId(),
                    name: activeMealSlot,
                    recipeTitle: m.recipeTitle,
                    time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
                    calories: m.calories,
                    protein: m.protein,
                    carbs: m.carbs,
                    fat: m.fat,
                  };
                  setByDay((prev) => ({
                    ...prev,
                    [dayKey]: [...(prev[dayKey] ?? []), meal],
                  }));
                  setShowPrevious(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{m.recipeTitle}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {m.calories} kcal · P {m.protein}g · C {m.carbs}g · F {m.fat}g
                  </Text>
                </View>
                <Ionicons name="add-circle" size={24} color={Neon.purple} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/** Calorie summary + bar (avoids SVG / New-Arch issues with circular strokes). */
function CalorieSummary({
  consumed,
  goal,
  remaining,
  styles,
}: {
  consumed: number;
  goal: number;
  remaining: number;
  styles: Record<string, any>;
}) {
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const over = remaining < 0;
  return (
    <View style={styles.calorieSummary}>
      <View style={styles.calorieHero}>
        <Text style={[styles.calorieHeroNumber, over && { color: Neon.red }]}>
          {over ? `+${Math.abs(remaining)}` : remaining}
        </Text>
        <Text style={styles.calorieHeroLabel}>{over ? "kcal over" : "kcal left"}</Text>
      </View>
      <View style={styles.calorieBarBlock}>
        <View style={styles.calorieBarLabels}>
          <Text style={styles.calorieBarMuted}>Food {consumed}</Text>
          <Text style={styles.calorieBarMuted}>Goal {goal}</Text>
        </View>
        <View style={styles.calorieBarTrack}>
          <View style={[styles.calorieBarFill, { width: `${pct * 100}%`, backgroundColor: over ? Neon.red : Neon.purple }]} />
        </View>
      </View>
    </View>
  );
}

function MacroBarRow({
  label,
  current,
  goal,
  color,
  styles,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
  styles: Record<string, any>;
}) {
  const pct = goal > 0 ? Math.min(1, current / goal) : 0;
  const rem = Math.max(0, goal - current);
  return (
    <View style={styles.macroBarBlock}>
      <View style={styles.macroBarTop}>
        <Text style={[styles.macroBarTitle, { color }]}>{label}</Text>
        <Text style={styles.macroBarNums}>
          {current}g / {goal}g · {rem}g left
        </Text>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}
