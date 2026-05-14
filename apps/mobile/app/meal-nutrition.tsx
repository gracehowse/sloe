import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { listMicroNutrientsCompleteDisplay, mealContributedFiberG, sumDayFiberFromMeals, sumMicrosFromLoggedMeals } from "@/lib/healthDietaryNutrients";
import { parseNutritionMicrosJson, type JournalMeal, normalizeJournalSlotName, dateKeyFromDate } from "@/lib/nutritionJournal";
import { supabase } from "@/lib/supabase";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import {
  macroSplitConfidence,
  macroSplitIncompleteCopy,
} from "../../../src/lib/nutrition/macroSplitConfidence";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function nutritionRowToJournalMeal(data: Record<string, unknown>): JournalMeal {
  return {
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
    createdAt: (data.created_at as string | null) ?? undefined,
  };
}

export default function MealNutritionScreen() {
  const { id: idParam, slot: slotParam, date: dateParam } = useLocalSearchParams<{
    id?: string | string[];
    slot?: string | string[];
    date?: string | string[];
  }>();
  const id = typeof idParam === "string" ? idParam : Array.isArray(idParam) ? idParam[0] : undefined;
  const slotFromParams =
    typeof slotParam === "string" ? slotParam : Array.isArray(slotParam) ? slotParam[0] : undefined;
  const dateFromParams =
    typeof dateParam === "string" ? dateParam : Array.isArray(dateParam) ? dateParam[0] : undefined;

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
  /** Populated in slot-summary mode (`?slot=&date=`) — each row opens single-meal nutrition. */
  const [slotLineItems, setSlotLineItems] = useState<JournalMeal[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError("Missing meal");
      setMeal(null);
      setSlotLineItems(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (id && UUID_RE.test(id)) {
        setSlotLineItems(null);
        const { data, error: qErr } = await supabase
          .from("nutrition_entries")
          .select(
            "id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier, source, nutrition_micros, created_at",
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
          setMeal(nutritionRowToJournalMeal(data as Record<string, unknown>));
        }
        return;
      }

      const slotRaw = slotFromParams?.trim();
      if (slotRaw && dateFromParams && DATE_KEY_RE.test(dateFromParams)) {
        const { data: rows, error: qErr } = await supabase
          .from("nutrition_entries")
          .select(
            "id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier, source, nutrition_micros, created_at",
          )
          .eq("user_id", userId)
          .eq("date_key", dateFromParams)
          .order("created_at", { ascending: true });

        if (qErr) {
          setError(qErr.message);
          setMeal(null);
          setSlotLineItems(null);
          return;
        }

        const targetSlot = normalizeJournalSlotName(slotRaw);
        const items = (rows ?? [])
          .map((r) => nutritionRowToJournalMeal(r as Record<string, unknown>))
          .filter((m) => normalizeJournalSlotName(m.name) === targetSlot);

        setDateKey(dateFromParams);
        if (items.length === 0) {
          setMeal(null);
          setSlotLineItems([]);
          setError("NO_SLOT_ITEMS");
          return;
        }

        const mergedMicros = sumMicrosFromLoggedMeals(items);
        delete mergedMicros.fiberG;

        const aggregate: JournalMeal = {
          id: "__slot_aggregate__",
          name: slotRaw,
          recipeTitle: `${slotRaw} · ${items.length} items`,
          time: "",
          calories: Math.round(items.reduce((a, m) => a + m.calories, 0)),
          protein: items.reduce((a, m) => a + m.protein, 0),
          carbs: items.reduce((a, m) => a + m.carbs, 0),
          fat: items.reduce((a, m) => a + m.fat, 0),
          fiberG: sumDayFiberFromMeals(items),
          micros: Object.keys(mergedMicros).length > 0 ? mergedMicros : undefined,
        };
        setMeal(aggregate);
        setSlotLineItems(items);
        setError(null);
        return;
      }

      setSlotLineItems(null);
      setMeal(null);
      setError(!id ? "Missing meal" : "Invalid meal id");
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[meal-nutrition] load failed:", err instanceof Error ? err.message : err);
      }
      setError(err instanceof Error ? err.message : "Could not load meal");
      setMeal(null);
      setSlotLineItems(null);
    } finally {
      setLoading(false);
    }
  }, [userId, id, slotFromParams, dateFromParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const fiberDisplay = meal ? mealContributedFiberG(meal) : 0;
  // Audit 2026-05-05 (Grace): Fiber moved from the macro-summary card
  // extras row into the "Vitamins, minerals & more" table where it
  // belongs alongside the rest of the per-entry breakdown. Inject the
  // resolved fiber value into the micros payload so the shared helper
  // surfaces it as the first row (`MICRO_LINES` puts `fiberG` first).
  // Falls back to "—" when zero, same as every other curated row.
  const microRows = useMemo(
    () =>
      listMicroNutrientsCompleteDisplay({
        ...(meal?.micros ?? {}),
        fiberG: fiberDisplay > 0 ? fiberDisplay : (meal?.micros?.fiberG ?? 0),
      }),
    [meal?.micros, fiberDisplay],
  );
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
    if (!meal || !dateKey || meal.id === "__slot_aggregate__") return;
    if (!UUID_RE.test(meal.id)) return;
    router.navigate({
      pathname: "/(tabs)",
      params: { date: dateKey, editMealId: meal.id, _t: String(Date.now()) },
    } as Parameters<typeof router.navigate>[0]);
  }, [router, meal, dateKey]);

  const isSlotAggregate = meal?.id === "__slot_aggregate__";

  useLayoutEffect(() => {
    if (isSlotAggregate) {
      navigation.setOptions({ headerShown: false });
      return;
    }
    navigation.setOptions({
      headerShown: true,
      title: meal?.recipeTitle?.trim() || "Meal nutrition",
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
        meal && !isSlotAggregate && UUID_RE.test(meal.id) ? (
          <Pressable onPress={openEditOnToday} hitSlop={12} style={{ paddingHorizontal: Spacing.md }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: Accent.primary }}>Edit</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, meal, isSlotAggregate, openEditOnToday, goBack, colors.text]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Accent.primary} />
      </View>
    );
  }

  if (error === "NO_SLOT_ITEMS" && slotFromParams) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: Spacing.lg }]}>
        <Ionicons name="nutrition-outline" size={44} color={colors.textTertiary} style={{ marginBottom: Spacing.md }} />
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: Spacing.sm }}>
          Nothing in {slotFromParams}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 320 }}>
          {dateFromParams
            ? `There are no logged items for this meal slot on ${dateFromParams}. Add food from Today, then open this summary again.`
            : "There are no logged items for this meal slot on that day."}
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
  // 2026-05-07 (Grace screenshot review): hide the "Portion ×1" line
  // entirely when the multiplier is the default — it adds no info and
  // reads as boilerplate. Keep visible only when the user actually
  // altered the portion (e.g. ×0.5 or ×2.5) so the override is
  // surfaced honestly.
  const showPortionLine = !isSlotAggregate && Math.abs(portion - 1) > 0.001;

  const slotDateLabel = formatDateLabel(dateKey ?? dateFromParams ?? "");

  return (
    <View style={{ flex: 1, backgroundColor: isSlotAggregate ? colors.background : colors.backgroundSecondary }}>
      {isSlotAggregate ? (
        <View
          style={{
            paddingTop: insets.top + Spacing.sm,
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.md,
            backgroundColor: colors.background,
          }}
        >
          <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }} numberOfLines={1}>
              {meal.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {slotDateLabel} · {slotLineItems?.length ?? 0} item{(slotLineItems?.length ?? 0) !== 1 ? "s" : ""}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: Accent.primary + "20",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: Radius.sm,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: Accent.primary,
                fontVariant: ["tabular-nums"],
              }}
            >
              {Math.round(meal.calories)} kcal
            </Text>
          </View>
        </View>
      ) : null}
      <ScrollView
        testID="screen-meal-nutrition"
        style={{ flex: 1, backgroundColor: isSlotAggregate ? colors.background : colors.backgroundSecondary }}
        contentContainerStyle={{
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: isSlotAggregate ? Spacing.lg : Spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {isSlotAggregate && slotLineItems && slotLineItems.length > 0 ? (
          <View style={{ marginBottom: Spacing.lg }}>
            {slotLineItems.map((line, i) => {
              const totalCal = Math.max(1, Math.round(meal.calories));
              const val = Math.round(line.calories);
              const pct = totalCal > 0 ? val / totalCal : 0;
              const upper = (line.time?.trim() || "Logged").toUpperCase();
              return (
                <Pressable
                  key={line.id}
                  onPress={() => router.push(`/meal-nutrition?id=${encodeURIComponent(line.id)}` as const)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 14,
                    borderBottomWidth: i < slotLineItems.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    gap: 12,
                    opacity: pressed ? 0.75 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open nutrition for ${line.recipeTitle || "item"}`}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: Accent.primary,
                      opacity: 0.3 + pct * 0.7,
                    }}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: colors.textTertiary,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                      numberOfLines={1}
                    >
                      {upper}
                    </Text>
                    <Text
                      style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginTop: 2 }}
                      numberOfLines={2}
                    >
                      {line.recipeTitle?.trim() || "Logged item"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: Accent.primary,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {val} kcal
                  </Text>
                </Pressable>
              );
            })}
            <View
              style={{
                marginTop: Spacing.lg,
                padding: Spacing.md,
                borderRadius: Radius.md,
                backgroundColor: Accent.primary + "10",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: 2,
                  height: 8,
                  borderRadius: 4,
                  overflow: "hidden",
                  backgroundColor: colors.border,
                }}
              >
                {slotLineItems.map((line, i) => {
                  const totalCal = Math.max(1, Math.round(meal.calories));
                  const val = Math.round(line.calories);
                  const pct = totalCal > 0 ? (val / totalCal) * 100 : 0;
                  return (
                    <View
                      key={line.id}
                      style={
                        {
                          width: `${Math.max(pct, 1)}%`,
                          height: "100%",
                          backgroundColor: Accent.primary,
                          opacity: 0.4 + (i % 3) * 0.2,
                        } as ViewStyle
                      }
                    />
                  );
                })}
              </View>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
                {Math.round(meal.calories)} kcal across {slotLineItems.length} logged item
                {slotLineItems.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        ) : null}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {!isSlotAggregate ? (
          <>
            <Text style={[styles.meta, { color: colors.textTertiary }]}>
              {[meal.name, meal.time].filter(Boolean).join(" · ")}
              {meal.source ? ` · ${meal.source}` : ""}
            </Text>
            {showPortionLine ? (
              <Text style={[styles.portion, { color: colors.textSecondary }]}>Portion ×{portionLabel}</Text>
            ) : null}
            <Text style={[styles.kcal, { color: colors.text }]}>{Math.round(meal.calories)} kcal</Text>
          </>
        ) : (
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: Spacing.sm }}>
            Combined macros
          </Text>
        )}

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

        {/* Audit 2026-05-05 (Grace): the Fiber + Water rows that
            previously lived here have moved (Fiber → "Vitamins,
            minerals & more" table below) or been cut (Water — not
            relevant to the per-entry meal nutrition view). */}
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
          const sourceLabel = isSlotAggregate
            ? "your logged items in this slot"
            : meal.source
              ? meal.source
              : "the data source";
          if (populatedCount === 0) {
            return (
              <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 0 }]}>
                {isSlotAggregate
                  ? "None of the entries in this slot included published vitamin or mineral data."
                  : `${sourceLabel} did not publish vitamin or mineral data for this product.`}
              </Text>
            );
          }
          return (
            <>
              <Text style={[styles.sectionSub, { color: colors.textTertiary }]}>
                {populatedCount} of {microRows.length} fields published by {sourceLabel}
                {showPortionLine ? `; values reflect portion ×${portionLabel}` : ""}.
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

      {/*
        2026-05-07 (Grace screenshot review): removed the inline
        "Edit entry" button + the trailing helper line ("On Today,
        tap a meal for this screen…"). The header-right "Edit" chip
        already routes to the same place, and helper text about how
        to navigate to this screen doesn't belong on the detail
        screen itself — it adds noise to a page that should be all
        meal data.
      */}
    </ScrollView>
    </View>
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
        <Text style={{ fontSize: 12, color: color, opacity: 0.85 }}>{pct}% of kcal</Text>
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
});
