import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { MacroColors, Neon, Spacing, Radius } from "@/constants/theme";

// Default targets — will come from profile later
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

  const dayKey = todayKey();
  const mealsToday = byDay[dayKey] ?? [];
  const targets = DEFAULT_TARGETS;

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

  const remaining = Math.max(0, targets.calories - totals.calories);

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
      const { data } = await supabase
        .from("nutrition_journals")
        .select("by_day")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.by_day && typeof data.by_day === "object") {
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
      name: "Snack",
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
  }, [dayKey, kcal, protein, carbs, fat, title]);

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

        {/* Date nav */}
        <View style={styles.dateNav}>
          <Text style={styles.dateNavArrow}>‹</Text>
          <Text style={styles.dateNavLabel}>Today</Text>
          <Text style={styles.dateNavArrow}>›</Text>
        </View>

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
              <Text style={[styles.calorieMathNumber, { color: Neon.cyan }]}>{remaining}</Text>
              <Text style={styles.calorieMathLabel}>Remaining</Text>
            </View>
          </View>
        </View>

        {/* Meal sections */}
        {Object.entries(mealGroups).map(([slot, meals]) => {
          const slotCals = meals.reduce((a, m) => a + m.calories, 0);
          const slotP = meals.reduce((a, m) => a + m.protein, 0);
          const slotC = meals.reduce((a, m) => a + m.carbs, 0);
          const slotF = meals.reduce((a, m) => a + m.fat, 0);
          return (
            <View key={slot} style={styles.card}>
              <View style={styles.mealSlotHeader}>
                <Text style={styles.mealSlotName}>{slot}</Text>
                <Text style={styles.mealSlotCals}>{slotCals}</Text>
              </View>
              <Text style={styles.mealSlotMacros}>
                Carbs {slotC}g · Fat {slotF}g · Protein {slotP}g
              </Text>
              {meals.map((m) => (
                <View key={m.id} style={styles.mealRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealName}>{m.recipeTitle}</Text>
                    <Text style={styles.mealMeta}>Protein: {m.protein}g</Text>
                  </View>
                  <Text style={styles.mealCals}>{m.calories}</Text>
                </View>
              ))}
              <Pressable style={styles.addFoodBtn} onPress={() => setAddOpen(true)}>
                <Text style={styles.addFoodBtnText}>ADD FOOD</Text>
              </Pressable>
            </View>
          );
        })}

        {mealsToday.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No meals logged yet today</Text>
            <Pressable style={styles.addFoodBtn} onPress={() => setAddOpen(true)}>
              <Text style={styles.addFoodBtnText}>ADD FOOD</Text>
            </Pressable>
          </View>
        )}

        {/* Add food form */}
        {addOpen && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Log</Text>
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
            <Pressable style={styles.submitBtn} onPress={addMeal}>
              <Text style={styles.submitBtnText}>Add to Today</Text>
            </Pressable>
          </View>
        )}

        {!addOpen && mealsToday.length > 0 && (
          <Pressable style={styles.floatingAdd} onPress={() => setAddOpen(true)}>
            <Text style={styles.floatingAddText}>+ Add Food</Text>
          </Pressable>
        )}
      </ScrollView>
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
  return (
    <View style={styles.calorieSummary}>
      <View style={styles.calorieHero}>
        <Text style={styles.calorieHeroNumber}>{remaining}</Text>
        <Text style={styles.calorieHeroLabel}>kcal left</Text>
      </View>
      <View style={styles.calorieBarBlock}>
        <View style={styles.calorieBarLabels}>
          <Text style={styles.calorieBarMuted}>Food {consumed}</Text>
          <Text style={styles.calorieBarMuted}>Goal {goal}</Text>
        </View>
        <View style={styles.calorieBarTrack}>
          <View style={[styles.calorieBarFill, { width: `${pct * 100}%` }]} />
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
