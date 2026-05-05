import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { listMicroNutrientsCompleteDisplay, mealContributedFiberG } from "@/lib/healthDietaryNutrients";
import { parseNutritionMicrosJson, type JournalMeal } from "@/lib/nutritionJournal";
import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import {
  macroSplitConfidence,
  macroSplitIncompleteCopy,
} from "../../../src/lib/nutrition/macroSplitConfidence";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function macroCalorieSplit(m: Pick<JournalMeal, "protein" | "carbs" | "fat">): {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
} {
  const proteinKcal = m.protein * 4;
  const carbsKcal = m.carbs * 4;
  const fatKcal = m.fat * 9;
  const sum = proteinKcal + carbsKcal + fatKcal;
  if (sum <= 0) {
    return { proteinPct: 0, carbsPct: 0, fatPct: 0, proteinKcal: 0, carbsKcal: 0, fatKcal: 0 };
  }
  // Audit M01 (2026-05-05) — largest-remainder (Hamilton) rounding so
  // the three displayed percentages always sum to exactly 100. Plain
  // `Math.round` per macro produced sums of 99 / 101 on near-equal
  // splits (e.g. 33.4 / 33.4 / 33.3 → 33+33+33=99; 33.5 / 33.5 / 33.0 →
  // 34+34+33=101). This method floors each, then adds 1 to the macros
  // with the largest fractional remainders until the sum hits 100.
  const exact = [
    { key: "protein", value: (proteinKcal / sum) * 100 },
    { key: "carbs", value: (carbsKcal / sum) * 100 },
    { key: "fat", value: (fatKcal / sum) * 100 },
  ] as const;
  const floored = exact.map((e) => ({ key: e.key, floor: Math.floor(e.value), remainder: e.value - Math.floor(e.value) }));
  let residual = 100 - floored.reduce((acc, e) => acc + e.floor, 0);
  // Sort indices by remainder descending, ties go to original macro
  // order (protein → carbs → fat) so output is deterministic.
  const indicesByRemainder = floored
    .map((e, i) => ({ i, remainder: e.remainder }))
    .sort((a, b) => b.remainder - a.remainder)
    .map((x) => x.i);
  const allocated = floored.map((e) => e.floor);
  for (let n = 0; n < indicesByRemainder.length && residual > 0; n++) {
    allocated[indicesByRemainder[n]!] += 1;
    residual -= 1;
  }
  return {
    proteinPct: allocated[0]!,
    carbsPct: allocated[1]!,
    fatPct: allocated[2]!,
    proteinKcal,
    carbsKcal,
    fatKcal,
  };
}

export default function MealNutritionScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof idParam === "string" ? idParam : Array.isArray(idParam) ? idParam[0] : undefined;

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)");
  const navigation = useNavigation();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meal, setMeal] = useState<JournalMeal | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId || !id || !UUID_RE.test(id)) {
      setLoading(false);
      setError(!id ? "Missing meal" : "Invalid meal id");
      setMeal(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("nutrition_entries")
      .select(
        "id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier, source, nutrition_micros",
      )
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (qErr) {
      setError(qErr.message);
      setMeal(null);
    } else if (!data) {
      setError("Meal not found");
      setMeal(null);
    } else {
      setDateKey((data.date_key as string) ?? null);
      setMeal({
        id: data.id as string,
        name: (data.name as string) ?? "",
        recipeTitle: (data.recipe_title as string) ?? "",
        time: (data.time_label as string) ?? "",
        calories: (data.calories as number) ?? 0,
        protein: (data.protein as number) ?? 0,
        carbs: (data.carbs as number) ?? 0,
        fat: (data.fat as number) ?? 0,
        fiberG: (data.fiber_g as number) ?? undefined,
        waterMl: (data.water_ml as number) ?? undefined,
        portionMultiplier: (data.portion_multiplier as number) ?? undefined,
        micros: parseNutritionMicrosJson((data as { nutrition_micros?: unknown }).nutrition_micros),
        source: (data.source as string) ?? undefined,
      });
    }
    setLoading(false);
  }, [userId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const microRows = useMemo(() => listMicroNutrientsCompleteDisplay(meal?.micros ?? null), [meal?.micros]);
  const fiberDisplay = meal ? mealContributedFiberG(meal) : 0;
  const split = useMemo(
    () => (meal ? macroCalorieSplit(meal) : { proteinPct: 0, carbsPct: 0, fatPct: 0, proteinKcal: 0, carbsKcal: 0, fatKcal: 0 }),
    [meal],
  );
  // F-82 (2026-04-25) — refuse to draw the macro split bar / "100% of
  // macro calories" labels when only one macro is non-zero AND that macro
  // can't account for the kcal claim (i.e. the source published kcal but
  // not the full macro breakdown). Closes the "Fly By Jing chili crisp =
  // 100% fat" failure mode for OFF entries with partial nutriments.
  const splitConfidence = useMemo(
    () =>
      meal
        ? macroSplitConfidence({
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
          })
        : ({ state: "empty" } as const),
    [meal],
  );

  const openEditOnToday = useCallback(() => {
    if (!meal || !dateKey) return;
    router.navigate({
      pathname: "/(tabs)",
      params: { date: dateKey, editMealId: meal.id, _t: String(Date.now()) },
    } as Parameters<typeof router.navigate>[0]);
  }, [router, meal, dateKey]);

  useLayoutEffect(() => {
    const title = meal?.recipeTitle?.trim() || "Meal nutrition";
    navigation.setOptions({
      title,
      // F-19 (2026-04-19) — the default native-header back was silently
      // no-op'ing in some cold-start / deep-link entry flows where the
      // stack held no history. Force a custom `headerLeft` wired to
      // `safeBack`, which falls back to `replace("/(tabs)")` so the
      // chevron always resolves. Matches the 20px hit-slop of the
      // default back button and styles the chevron to the current
      // text colour so it reads in both light + dark.
      headerLeft: () => (
        <Pressable
          onPress={goBack}
          hitSlop={20}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      ),
      headerRight: () =>
        meal ? (
          <Pressable onPress={openEditOnToday} hitSlop={12} style={{ paddingHorizontal: Spacing.md }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: Accent.primary }}>Edit</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, meal, openEditOnToday, goBack, colors.text]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Accent.primary} />
      </View>
    );
  }

  if (error || !meal) {
    // Audit 2026-05-04 #6: previously this was bare "Missing meal" + bare
    // "Go back" link with no chrome — read as a crashed route. Mirror the
    // cook-mode empty-state pattern (heading + subtitle + styled CTA) so
    // the user has a clear recovery path that looks like a designed surface.
    const heading = error === "Missing meal" || error === "Invalid meal id" ? "Meal not found" : "Couldn't load meal";
    const subtitle =
      error === "Missing meal"
        ? "We couldn't find that meal. It may have been deleted or the link is missing an id."
        : error === "Invalid meal id"
          ? "That meal link doesn't look right. Open the meal again from Today."
          : "Something went wrong loading this meal. Check your connection and try again.";
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: Spacing.lg }]}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.textTertiary} style={{ marginBottom: Spacing.md }} />
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: Spacing.sm }}>
          {heading}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 320 }}>
          {subtitle}
        </Text>
        <Pressable
          onPress={goBack}
          style={{
            marginTop: Spacing.lg,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: Radius.md,
            backgroundColor: Accent.primary,
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const portion = meal.portionMultiplier ?? 1;
  const portionLabel = Number.isInteger(portion) ? String(portion) : String(Math.round(portion * 100) / 100);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          {[meal.name, meal.time].filter(Boolean).join(" · ")}
          {meal.source ? ` · ${meal.source}` : ""}
        </Text>
        <Text style={[styles.portion, { color: colors.textSecondary }]}>Portion ×{portionLabel}</Text>
        <Text style={[styles.kcal, { color: colors.text }]}>{Math.round(meal.calories)} kcal</Text>

        {splitConfidence.state === "single_macro" ? (
          // F-82 — incomplete-data state. Skip the misleading bar +
          // "100% of macro calories" labels and explain what's missing.
          <View style={styles.incompleteMacroPanel}>
            <Text style={[styles.incompleteMacroCopy, { color: colors.textSecondary }]}>
              {macroSplitIncompleteCopy(splitConfidence.presentMacro)}
            </Text>
            <View style={styles.macroGrid}>
              <MacroStat label="Protein" grams={meal.protein} pct={null} color={MacroColors.protein} textColor={colors.text} />
              <MacroStat label="Carbs" grams={meal.carbs} pct={null} color={MacroColors.carbs} textColor={colors.text} />
              <MacroStat label="Fat" grams={meal.fat} pct={null} color={MacroColors.fat} textColor={colors.text} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.macroBar}>
              {splitConfidence.state === "complete" ? (
                <>
                  <View style={[styles.macroSeg, { flex: Math.max(split.proteinPct, 1), backgroundColor: MacroColors.protein }]} />
                  <View style={[styles.macroSeg, { flex: Math.max(split.carbsPct, 1), backgroundColor: MacroColors.carbs }]} />
                  <View style={[styles.macroSeg, { flex: Math.max(split.fatPct, 1), backgroundColor: MacroColors.fat }]} />
                </>
              ) : (
                <View style={[styles.macroSeg, { flex: 1, backgroundColor: colors.cardBorder }]} />
              )}
            </View>

            <View style={styles.macroGrid}>
              <MacroStat label="Protein" grams={meal.protein} pct={split.proteinPct} color={MacroColors.protein} textColor={colors.text} />
              <MacroStat label="Carbs" grams={meal.carbs} pct={split.carbsPct} color={MacroColors.carbs} textColor={colors.text} />
              <MacroStat label="Fat" grams={meal.fat} pct={split.fatPct} color={MacroColors.fat} textColor={colors.text} />
            </View>
          </>
        )}

        <View style={[styles.extras, { borderTopColor: colors.cardBorder }]}>
          <Text style={[styles.extraLine, { color: colors.textSecondary }]}>
            Fiber{" "}
            <Text style={{ fontWeight: "700", color: colors.text }}>
              {fiberDisplay > 0 ? `${Math.round(fiberDisplay * 10) / 10}g` : "—"}
            </Text>
          </Text>
          <Text style={[styles.extraLine, { color: colors.textSecondary }]}>
            Water{" "}
            <Text style={{ fontWeight: "700", color: colors.text }}>
              {meal.waterMl != null && meal.waterMl > 0 ? `${Math.round(meal.waterMl)} ml` : "—"}
            </Text>
          </Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: Spacing.md, backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Vitamins, minerals & more</Text>
        {/* F-86 (2026-04-25) — when every micro row is "—" the panel reads
            as a debug surface (ui-critic 2026-04-25: "the database talking
            instead of product voice"). Collapse to a source-attributed
            empty state in that case; otherwise render the full list with
            an attribution line that re-frames absence as the source's
            gap, not Suppr's. */}
        {(() => {
          const populatedCount = microRows.filter((row) => row.value !== "—").length;
          const sourceLabel = meal.source ? meal.source : "the data source";
          if (populatedCount === 0) {
            return (
              <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 0 }]}>
                {sourceLabel} did not publish vitamin or mineral data for this product.
              </Text>
            );
          }
          return (
            <>
              <Text style={[styles.sectionSub, { color: colors.textTertiary }]}>
                {populatedCount} of {microRows.length} fields published by {sourceLabel}; values reflect portion ×{portionLabel}.
              </Text>
              {microRows.map((row) => (
                <View key={row.key} style={[styles.microRow, { borderBottomColor: colors.cardBorder + "55" }]}>
                  <Text style={[styles.microLabel, { color: colors.text }]} numberOfLines={2}>
                    {row.label}
                  </Text>
                  <Text
                    style={[
                      styles.microValue,
                      { color: row.value === "—" ? colors.textTertiary : colors.textSecondary },
                    ]}
                  >
                    {row.value === "—" ? "Not published" : row.value}
                  </Text>
                </View>
              ))}
            </>
          );
        })()}
      </View>

      <Pressable
        onPress={openEditOnToday}
        style={[styles.editCta, { marginTop: Spacing.md, backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
      >
        <Ionicons name="create-outline" size={20} color={Accent.primary} />
        <Text style={{ marginLeft: 10, fontSize: 15, fontWeight: "600", color: Accent.primary }}>Edit entry</Text>
        <Ionicons name="chevron-forward" size={18} color={Accent.primary} style={{ marginLeft: "auto" }} />
      </Pressable>

      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        On Today, tap a meal for this screen; long-press for quick delete or edit.
      </Text>
    </ScrollView>
  );
}

function MacroStat({
  label,
  grams,
  pct,
  color,
  textColor,
}: {
  label: string;
  grams: number;
  /** F-82 — `null` suppresses the "X% of macro calories" line for incomplete-data rows. */
  pct: number | null;
  color: string;
  textColor: string;
}) {
  return (
    <View style={styles.macroCell}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: textColor, marginTop: 4 }}>{Math.round(grams * 10) / 10}g</Text>
      {pct != null ? (
        <Text style={{ fontSize: 12, color: color, opacity: 0.85 }}>{pct}% of macro calories</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  meta: { fontSize: 12, marginBottom: 4 },
  portion: { fontSize: 13, marginBottom: Spacing.sm },
  kcal: { fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"], marginBottom: Spacing.md },
  macroBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: Spacing.md },
  macroSeg: { minWidth: 2 },
  macroGrid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  macroCell: { flex: 1 },
  extras: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  extraLine: { fontSize: 14, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  sectionSub: { fontSize: 12, lineHeight: 17, marginBottom: Spacing.sm },
  microRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  microLabel: { flex: 1, fontSize: 14 },
  microValue: { fontSize: 14, fontVariant: ["tabular-nums"] },
  incompleteMacroPanel: { marginBottom: Spacing.md },
  incompleteMacroCopy: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.sm },
  editCta: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  hint: { fontSize: 12, marginTop: Spacing.md, textAlign: "center", lineHeight: 18 },
});
