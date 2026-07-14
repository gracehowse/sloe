import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CircleAlert, Salad } from "lucide-react-native";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useCardElevation } from "@/hooks/useCardElevation";
import { listMicroNutrientsCompleteDisplay, mealContributedFiberG, sumDayFiberFromMeals, sumMicrosFromLoggedMeals } from "@/lib/healthDietaryNutrients";
import { slotLineItemLabels } from "@/lib/mealNutritionLabels";
import { formatNutritionSourceLabel } from "@/lib/sourceLabel";
import { parseNutritionMicrosJson, type JournalMeal, normalizeJournalSlotName, dateKeyFromDate } from "@/lib/nutritionJournal";
import { supabase } from "@/lib/supabase";
import { withAlpha, Accent, FontFamily, MacroColors, MacroColorsDark, Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { MacroTotalGrid, type MacroTotalCell } from "@/components/meal/MacroTotalGrid";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { NutritionDetailEmptyState } from "@/components/nutrition/NutritionDetailEmptyState";
import {
  macroSplitConfidence,
  macroSplitIncompleteCopy,
} from "@suppr/nutrition-core/macroSplitConfidence";
import { macroCalorieSplit } from "@suppr/nutrition-core/macroCalorieSplit";
import { formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";

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

// Audit M01 (2026-05-05) — the macro kcal-split + largest-remainder (Hamilton)
// rounding (so the three displayed percentages always sum to exactly 100) now
// lives in the shared `@suppr/nutrition-core/macroCalorieSplit` module, imported
// above and shared with the web meal-nutrition dialog (P5 parity gap #15).

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
  const accent = useAccent();
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
  const colors = useThemeColors(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
  const cardElevation = useCardElevation();
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
  // ENG-1247 (v3 `.md-totalgrid`): Fibre now leads the 4-cell macro grid above
  // (real `mealContributedFiberG`, not the prototype's `carbs × 0.13` guess), so
  // it no longer belongs in the "Vitamins, minerals & more" table — strip
  // `fiberG` here so it is never shown twice. The grid is its single home.
  const microRows = useMemo(() => {
    const micros = { ...(meal?.micros ?? {}) };
    delete micros.fiberG;
    return listMicroNutrientsCompleteDisplay(micros);
  }, [meal?.micros]);
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

  // v3 `.md-totalgrid` cells — Protein / Carbs / Fat / Fibre. Fibre is REAL
  // (`fiberDisplay`), never the prototype's `carbs × 0.13` guess. Tapping a cell
  // opens that macro's day breakdown (`/macro-detail`, date below).
  const navDateKey = dateKey || dateFromParams || dateKeyFromDate(new Date());
  const macroCells: MacroTotalCell[] = meal
    ? [
        { key: "protein", label: "Protein", grams: meal.protein, color: mc.protein },
        { key: "carbs", label: "Carbs", grams: meal.carbs, color: mc.carbs },
        { key: "fat", label: "Fat", grams: meal.fat, color: mc.fat },
        { key: "fiber", label: "Fibre", grams: fiberDisplay, color: mc.fiber },
      ]
    : [];

  const openEditOnToday = useCallback(() => {
    if (!meal || !dateKey || meal.id === "__slot_aggregate__") return;
    if (!UUID_RE.test(meal.id)) return;
    router.navigate({
      pathname: "/(tabs)",
      params: { date: dateKey, editMealId: meal.id, _t: String(Date.now()) },
    } as Parameters<typeof router.navigate>[0]);
  }, [router, meal, dateKey]);

  const isSlotAggregate = meal?.id === "__slot_aggregate__";
  const canEdit = !!meal && !isSlotAggregate && UUID_RE.test(meal.id);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={accent.primary} />
      </View>
    );
  }

  // ENG-825 (2026-05-31 design-direction macro/meal lane): the slot-empty
  // and load-error states previously hand-rolled their own centred Ionicon +
  // heading + plain `Go back` Pressable — a SECOND header/icon/CTA system
  // distinct from the macro-detail sibling. Both now share `PushScreenHeader`
  // (lucide chrome, back always present) + the elevated `NutritionDetailEmptyState`
  // card with a blue scale-press CTA. Visual changes stay gated inside the
  // shared component; the OLD flat / blue-CTA path lives in its flag-OFF branch.
  if (error === "NO_SLOT_ITEMS" && slotFromParams) {
    return (
      <View style={[styles.errorScreen, { backgroundColor: colors.background }]}>
        <PushScreenHeader title="Nutrition" onBack={goBack} />
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <NutritionDetailEmptyState
            testID="meal-nutrition-empty"
            icon={Salad}
            title={`Nothing in ${slotFromParams}`}
            subtitle={
              dateFromParams
                ? `There are no logged items for this meal slot on ${dateFromParams}. Add food from Today, then open this summary again.`
                : "There are no logged items for this meal slot on that day."
            }
            ctaLabel="Go back"
            onPress={goBack}
          />
        </View>
      </View>
    );
  }

  if (error || !meal) {
    // Audit 2026-05-04 #6: previously this was bare "Missing meal" + bare
    // "Go back" link with no chrome — read as a crashed route. Now mirrors the
    // shared elevated empty-state card so the recovery path looks designed.
    const heading = error === "Missing meal" || error === "Invalid meal id" ? "Meal not found" : "Couldn't load meal";
    const subtitle =
      error === "Missing meal"
        ? "We couldn't find that meal. It may have been deleted or the link is missing an id."
        : error === "Invalid meal id"
          ? "That meal link doesn't look right. Open the meal again from Today."
          : "Something went wrong loading this meal. Check your connection and try again.";
    return (
      <View style={[styles.errorScreen, { backgroundColor: colors.background }]}>
        <PushScreenHeader title="Nutrition" onBack={goBack} />
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <NutritionDetailEmptyState
            testID="meal-nutrition-error"
            icon={CircleAlert}
            title={heading}
            subtitle={subtitle}
            ctaLabel="Go back"
            onPress={goBack}
          />
        </View>
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
  const sectionA = isFeatureEnabled("eng1247_section_a_v1");

  // ENG-825 — resting-card treatment via the shared `useCardElevation`
  // hook (replaces the two hand-rolled `borderWidth: 1` cards below).
  // Flag OFF → flat + hairline (unchanged). `design_system_elevation` ON →
  // soft ambient shadow (light) / tonal lift + hairline (dark). These cards
  // don't `overflow: hidden`, so the shadow can sit directly on the card.
  const cardSurfaceStyle: ViewStyle = {
    backgroundColor: cardElevation.liftBg ?? colors.card,
    borderWidth: cardElevation.useBorder ? 1 : 0,
    borderColor: colors.cardBorder,
    ...(cardElevation.shadowStyle ?? {}),
  };

  return (
    <View style={{ flex: 1, backgroundColor: isSlotAggregate ? colors.background : colors.backgroundSecondary }}>
      {/* ENG-825 (2026-05-31 design-direction macro/meal lane): single
          unified header system across BOTH the slot-aggregate and the
          single-meal modes — `PushScreenHeader` (lucide back chevron),
          matching the macro-detail sibling. The single-meal mode used to
          render the NATIVE stack header with an Ionicons back chevron + a
          header-right "Edit" link; that second header/icon system is gone.
          Slot-aggregate keeps its calorie value pill; single-meal carries
          the "Edit" action in the right slot. */}
      {isSlotAggregate ? (
        <PushScreenHeader
          title={meal.name}
          caption={`${slotDateLabel} · ${slotLineItems?.length ?? 0} item${(slotLineItems?.length ?? 0) !== 1 ? "s" : ""}`}
          onBack={goBack}
          rightSlot={
            <View
              style={{
                backgroundColor: withAlpha(accent.primary, 0x20),
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: Radius.sm,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: accent.primarySolid,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatKcalDisplay(meal.calories)} kcal
              </Text>
            </View>
          }
        />
      ) : (
        <PushScreenHeader
          title={meal.recipeTitle?.trim() || "Meal nutrition"}
          caption={[meal.name, slotDateLabel].filter(Boolean).join(" · ") || undefined}
          onBack={goBack}
          rightSlot={
            canEdit ? (
              <Pressable
                onPress={openEditOnToday}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Edit this meal"
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: accent.primarySolid }}>
                  Edit
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
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
              // Single "Logged" affordance — see `slotLineItemLabels`. A
              // timeless row used to read "LOGGED / Logged item" (Grace).
              const { overline: upper, title: lineTitle } = slotLineItemLabels(
                line.time,
                line.recipeTitle,
              );
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
                      backgroundColor: accent.primary,
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
                      {lineTitle}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: Type.bodyLarge.fontFamily,
                      fontSize: Type.bodyLarge.fontSize,
                      lineHeight: Type.bodyLarge.lineHeight,
                      fontWeight: "700",
                      color: accent.primarySolid,
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
                backgroundColor: withAlpha(accent.primary, 0x10),
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
                          backgroundColor: accent.primary,
                          opacity: 0.4 + (i % 3) * 0.2,
                        } as ViewStyle
                      }
                    />
                  );
                })}
              </View>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
                {formatKcalDisplay(meal.calories)} kcal across {slotLineItems.length} logged item{slotLineItems.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        ) : null}
      <View style={[styles.card, cardSurfaceStyle]}>
        {!isSlotAggregate ? (
          <>
            <Text
              style={[
                sectionA ? styles.metaOverline : styles.meta,
                { color: colors.textTertiary },
              ]}
              testID="meal-nutrition-meta-overline"
            >
              {[meal.name, meal.time].filter(Boolean).join(" · ")}
              {meal.source ? ` · ${formatNutritionSourceLabel(meal.source)}` : ""}
            </Text>
            {showPortionLine ? (
              <Text style={[styles.portion, { color: colors.textSecondary }]}>Portion ×{portionLabel}</Text>
            ) : null}
            <Text style={[styles.kcal, { color: colors.text }]}>{formatKcalDisplay(meal.calories)} kcal</Text>
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
            <MacroTotalGrid cells={macroCells} dateKey={navDateKey} />
          </View>
        ) : (
          <>
            {!sectionA ? (
              <View style={styles.macroBar}>
                {splitConfidence.state === "complete" ? (
                  <>
                    <View style={[styles.macroSeg, { flex: Math.max(split.proteinPct, 1), backgroundColor: mc.protein }]} />
                    <View style={[styles.macroSeg, { flex: Math.max(split.carbsPct, 1), backgroundColor: mc.carbs }]} />
                    <View style={[styles.macroSeg, { flex: Math.max(split.fatPct, 1), backgroundColor: mc.fat }]} />
                  </>
                ) : (
                  <View style={[styles.macroSeg, { flex: 1, backgroundColor: colors.cardBorder }]} />
                )}
              </View>
            ) : null}

            <MacroTotalGrid cells={macroCells} dateKey={navDateKey} />
          </>
        )}

        {/* Audit 2026-05-05 (Grace): the Fiber + Water rows that
            previously lived here have moved (Fiber → "Vitamins,
            minerals & more" table below) or been cut (Water — not
            relevant to the per-entry meal nutrition view). */}
      </View>

      <View style={[styles.card, { marginTop: Spacing.md }, cardSurfaceStyle]}>
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
            : formatNutritionSourceLabel(meal.source) ?? "the data source";
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
              {/* e2e walk 2026-06-10 (Grace report follow-up): render ONLY
                  the populated rows. The previous full list painted a wall
                  of 13+ grey not-published rows — dead chrome on a
                  daily-traffic screen (calm-minimal empty-state decision,
                  2026-06-09; same class as the recipe-detail allergen
                  null-state collapse). Absent fields collapse to one quiet
                  summary line below. */}
              {microRows
                .filter((row) => row.value !== "—")
                .map((row) => (
                  <View key={row.key} style={[styles.microRow, { borderBottomColor: withAlpha(colors.cardBorder, 0x55) }]}>
                    <Text style={[styles.microLabel, { color: colors.text }]} numberOfLines={2}>
                      {row.label}
                    </Text>
                    <Text style={[styles.microValue, { color: colors.textSecondary }]}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              {populatedCount < microRows.length ? (
                <Text
                  testID="meal-nutrition-micros-rest"
                  style={[styles.sectionSub, { color: colors.textTertiary, marginTop: Spacing.sm, marginBottom: 0 }]}
                >
                  {microRows.length - populatedCount} more not published by {sourceLabel}.
                </Text>
              ) : null}
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Error / empty screens: the in-screen `PushScreenHeader` sits at the top,
  // the centred empty-state card below it (not vertically centred over the
  // whole screen — the header anchors the top).
  errorScreen: { flex: 1 },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  meta: { ...Type.captionSmall, marginBottom: 4 },
  metaOverline: { ...Type.label, textTransform: "uppercase", marginBottom: 4 },
  portion: { fontSize: 13, marginBottom: Spacing.sm },
  // SLOE Phase 0: the big standalone meal-kcal hero reads in Newsreader serif
  // (the design system reserves big numerals for serif). Family carries the
  // weight, so the sans `fontWeight: 800` is dropped; size/box/tabular kept.
  kcal: { fontFamily: FontFamily.serifRegular, fontSize: 28, fontVariant: ["tabular-nums"], marginBottom: Spacing.md },
  macroBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: Spacing.md },
  macroSeg: { minWidth: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  sectionSub: { ...Type.captionSmall, lineHeight: 17, marginBottom: Spacing.sm },
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
