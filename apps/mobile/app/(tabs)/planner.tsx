import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { upsertShoppingListJsonItems } from "../../../../src/lib/supabase/shoppingJsonFallback";
import { fetchMealPlanJson, upsertMealPlanJson } from "../../../../src/lib/supabase/phase1LegacyJsonb";
import { dateKeyFromDate, newMealId } from "@/lib/nutritionJournal";
import { snapshotDailyTargetIfMissing } from "../../../../src/lib/nutrition/dailyTargetSnapshot";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets } from "@/lib/calcTargets";
import { generateSmartPlan, ALL_MEAL_SLOTS, type PlannerTargets } from "@/lib/mealPlanAlgo";
import { isMealPlanPlaceholderLikeTitle } from "../../../../src/lib/nutrition/portionMultiplier";
import {
  buildDayTotalVsGoalLine,
  formatDayTotalCell,
  type DayTotalTone,
} from "../../../../src/lib/planning/dayTotalVsGoal";
import Badge from "@/components/Badge";
import {
  countLeftoversOfRecipe,
  distributeLeftovers,
  markLeftoversOnSwap,
  moveMealInPlan,
  type LeftoverAwareMeal,
} from "../../../../src/lib/nutrition/leftoversPlanner";
import {
  buildTemplateFromWeek,
  applyTemplateToWeek,
  type PlanTemplate,
} from "../../../../src/lib/nutrition/planTemplates";
import {
  createPlanTemplate,
  deletePlanTemplate,
  listPlanTemplates,
} from "../../../../src/lib/nutrition/planTemplatesClient";
import { normaliseMealSlot } from "../../../../src/lib/nutrition/mealSlots";
import {
  isSameCalendarDay,
  resolvePlanSlotIconKey,
  shortWeekdayLabel,
  type PlanSlotIconKey,
} from "../../../../src/lib/planning/planDayLabel";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import { track } from "@/lib/analytics";
import * as Haptics from "expo-haptics";
import { HouseholdCard } from "@/components/HouseholdCard";
import { MoveMealSheet } from "@/components/MoveMealSheet";
import { PlanTemplatesSheet } from "@/components/PlanTemplatesSheet";
import { useMealPlanSlots } from "@/hooks/use-meal-plan-slots";

function stripPlanPlaceholders<T extends { recipeTitle: string; isPlaceholder?: boolean }>(meals: T[]): T[] {
  return meals.filter(
    (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
  );
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

// Prototype port (2026-04-20) — slot icon key → Ionicons name. Mirrored
// on web with lucide-react icons (see `MealPlanner.tsx` `SLOT_ICON_WEB`).
// Keys come from the shared `resolvePlanSlotIconKey` so legacy / voice
// slot values can never drift a row into a blank square.
// Keep in sync with `TodayMealsSection.tsx` `SLOT_ICON` — Plan and Today
// must show the same icon per slot (Grace 2026-04-20).
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
type MciName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const SLOT_ICON_MOBILE: Record<
  PlanSlotIconKey,
  { family: "ionicons"; name: IoniconName } | { family: "mci"; name: MciName }
> = {
  breakfast: { family: "ionicons", name: "cafe-outline" },
  lunch: { family: "ionicons", name: "sunny-outline" },
  dinner: { family: "ionicons", name: "restaurant-outline" },
  snacks: { family: "mci", name: "cookie-outline" },
};

// Colour parity with `TodayMealsSection.tsx` `SLOT_COLOR`.
const SLOT_COLOR_MOBILE: Record<PlanSlotIconKey, string> = {
  breakfast: Accent.warning,
  lunch: Accent.success,
  dinner: Accent.primary,
  snacks: MacroColors.fat,
};

function stripMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calendar date for plan row at index `idx`, offset from today by `offset` days. */
function planCalendarDateForIndex(idx: number, offset: number = 0): Date {
  const d = stripMidnight(new Date());
  d.setDate(d.getDate() + idx + offset);
  return d;
}

type PlanMeal = {
  name: string;
  recipeTitle: string;
  /** Stable navigation target; older saved plans may omit this. */
  recipeId?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  portionMultiplier?: number;
  isPlaceholder?: boolean;
  /** Batch 3.10 — leftover parent recipe id. Visual-only; macros equal parent. */
  leftoverOf?: string;
  /** Batch 3.10 — visual-only companion to `leftoverOf`. */
  isLeftover?: boolean;
};

type DayPlan = {
  day: number;
  meals: PlanMeal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  /**
   * F-15 — grams of protein below the day target after the joint-fit
   * scaler ran. Negative grams when the scaler couldn't close the gap.
   * Day card surfaces the hint only when `residualProteinGap < -10`.
   */
  residualProteinGap?: number;
};

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();

  const { recipes: discoverRecipes } = useDiscoverRecipes();
  const { recipes: savedRecipes } = useSavedLibraryRecipes(userId);

  // Named meal-plan slots — mobile parity for web's
  // `mealPlanSlots / activeMealPlanSlotId / switchMealPlanSlot`
  // (`src/context/AppDataContext.tsx`). The hook persists slot
  // metadata to AsyncStorage; the cloud syncs only the active plan
  // via `upsertMealPlanJson` (same as web localStorage). Aliasing
  // `activePlan → plan` and `setActivePlan → setPlan` so the rest of
  // this file's existing logic doesn't need to change.
  const {
    slots: planSlots,
    activeSlotId: activePlanSlotId,
    activePlan: plan,
    setActivePlan: setPlan,
    switchSlot: switchPlanSlot,
    createNewSlot: createPlanSlot,
    renameExistingSlot: renamePlanSlot,
    deleteExistingSlot: deletePlanSlot,
  } = useMealPlanSlots();
  const [generating, setGenerating] = useState(false);
  const [planSlotMenuOpen, setPlanSlotMenuOpen] = useState(false);
  const [days, setDays] = useState<1 | 3 | 7>(1);
  const [startOffset, setStartOffset] = useState<0 | 1 | 7>(0); // 0=today, 1=tomorrow, 7=next week
  const [userTier, setUserTier] = useState<"free" | "base" | "pro">("free");

  // Load user tier from profile
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
          setUserTier("free");
        }
      });
  }, [userId]);

  const isFree = userTier === "free";
  const [planTargets, setPlanTargets] = useState<{ calories: number; protein: number; carbs: number; fat: number; fiber?: number } | null>(null);
  const [enabledSlots, setEnabledSlots] = useState<Set<string>>(new Set(ALL_MEAL_SLOTS));
  const [shoppingItemCount, setShoppingItemCount] = useState(0);

  // Batch 3.10 — plan templates state.
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Batch 3.10 (mobile parity, 2026-04-18 audit C2) — Move meal state.
  // Long-press a meal row → action sheet → "Move to another slot…" opens
  // `MoveMealSheet` with `moveSource` set to the pressed cell.
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [moveSource, setMoveSource] = useState<{ day: number; slotIndex: number } | null>(null);

  useEffect(() => {
    if (!templatesOpen || !userId) return;
    let cancelled = false;
    setTemplatesLoading(true);
    listPlanTemplates(supabase, userId)
      .then(({ templates, error }) => {
        if (cancelled) return;
        if (error) {
          Alert.alert("Templates", `Could not load templates: ${error}`);
          return;
        }
        setPlanTemplates(templates);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templatesOpen, userId]);

  // Load shopping item count. The shopping list is ephemeral — it
  // only makes sense in the context of an active plan. When there is
  // no plan on the active slot (fresh account, slot deleted, switched
  // to an empty slot) clear the count so the "N items from this week"
  // subtitle never references a previous plan's list, and wipe any
  // stale `shopping_items` rows the user might see if they open the
  // Shopping screen directly.
  // F-9 (TestFlight `AMXSjeaXJeCf6QtKgUTMkD0`, 2026-04-18). Web parity
  // is handled in `src/context/AppDataContext.tsx`'s shopping-clear
  // effect (same `shoppingListShouldClear` rule); mobile persists
  // shopping state directly in the DB (no shared context), so the
  // cleanup lives here.
  const priorPlanRef = useRef(plan);
  useEffect(() => {
    if (!userId) return;
    const prev = priorPlanRef.current;
    priorPlanRef.current = plan;
    if (!plan) {
      setShoppingItemCount(0);
      // Only hit the server when the plan actually transitioned to
      // null this render; avoids a delete on every cold start with
      // no plan (there's nothing to clean up then either).
      if (prev) {
        void supabase.from("shopping_items").delete().eq("user_id", userId);
      }
      return;
    }
    supabase
      .from("shopping_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(({ count }) => {
        setShoppingItemCount(count ?? 0);
      });
  }, [userId, plan]);

  const swapMeal = useCallback((dayIndex: number, mealIndex: number, slotName: string) => {
    const allPool = [...savedRecipes, ...discoverRecipes];
    // Audit L5 (2026-04-18): canonical slot via `normaliseMealSlot`
    // so "breakfast" / "Breakfast" / "BREAKFAST" all collapse to the
    // same branch. Unknown slots fall through to the snack ratio
    // (matches the prior default branch).
    const canonicalSlot = normaliseMealSlot(slotName);
    const fits = allPool.filter((r) => {
      const tags = r.mealSlots ?? [];
      return tags.length === 0 || tags.some((t: string) => normaliseMealSlot(t) === canonicalSlot);
    });
    if (fits.length === 0) {
      Alert.alert("No alternatives", "Save more recipes to swap.");
      return;
    }

    // Sort by calorie closeness to target slot budget
    const slotRatio =
      canonicalSlot === "Breakfast" ? 0.25 :
      canonicalSlot === "Lunch" ? 0.3 :
      canonicalSlot === "Dinner" ? 0.35 :
      0.1;
    const slotTarget = planTargets ? planTargets.calories * slotRatio : 400;
    const sorted = [...fits].sort((a, b) => Math.abs(a.calories - slotTarget) - Math.abs(b.calories - slotTarget));

    const options = sorted.slice(0, 10).map((r) => `${r.title} (${r.calories} kcal)`);
    options.push("Cancel");

    Alert.alert(
      `Swap ${slotName}`,
      `Target: ~${Math.round(slotTarget)} kcal for this slot`,
      options.map((label, idx) => ({
        text: label,
        style: idx === options.length - 1 ? "cancel" as const : "default" as const,
        onPress: idx === options.length - 1 ? undefined : () => {
          const picked = sorted[idx];
          if (!picked || !plan) return;

          // Calculate ideal portion to hit slot target
          const idealMult = picked.calories > 0 ? Math.round((slotTarget / picked.calories) * 4) / 4 : 1;
          const mult = Math.max(0.25, Math.min(2, idealMult));
          const scaledCals = Math.round(picked.calories * mult);

          // Compute new day total
          const currentDay = plan[dayIndex];
          if (!currentDay) return;
          const otherMealsCals = currentDay.meals.reduce((s, m, mi) => mi === mealIndex ? s : s + m.calories, 0);
          const newDayTotal = otherMealsCals + scaledCals;
          const dayTarget = planTargets?.calories ?? 2000;

          const doSwap = () => {
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
                    calories: Math.round(picked.calories * mult),
                    protein: Math.round(picked.protein * mult),
                    carbs: Math.round(picked.carbs * mult),
                    fat: Math.round(picked.fat * mult),
                    portionMultiplier: mult !== 1 ? mult : undefined,
                  };
                });
                const totals = newMeals.reduce(
                  (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
                  { calories: 0, protein: 0, carbs: 0, fat: 0 },
                );
                return { ...dp, meals: newMeals, totals };
              });
            });
          };

          // Warn if >10% over target
          if (newDayTotal > dayTarget * 1.1) {
            Alert.alert(
              "Over calorie target",
              `This swap puts the day at ${newDayTotal.toLocaleString()} kcal (target: ${dayTarget.toLocaleString()}).\n\nPortion: ${mult}x = ${scaledCals} kcal`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Swap anyway", onPress: doSwap },
              ],
            );
          } else {
            doSwap();
          }
        },
      })),
    );
  }, [savedRecipes, discoverRecipes, plan, planTargets]);

  /**
   * Persist a plan back to Supabase — relational tables first with legacy
   * JSONB fallback. Mirrors the tail of `generatePlan`.
   */
  const persistPlan = useCallback(
    async (nextPlan: DayPlan[]) => {
      if (!userId) return;
      const { error: delErr } = await supabase
        .from("meal_plan_days")
        .delete()
        .eq("user_id", userId)
        .eq("slot_id", "default");
      if (delErr) {
        void upsertMealPlanJson(supabase, userId, nextPlan);
        return;
      }
      for (const dp of nextPlan) {
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
    },
    [userId],
  );

  // Batch 3.10 mobile parity — move a meal between slots / days.
  // Uses the shared `moveMealInPlan` helper. Two-way swap when destination
  // is occupied; source becomes an empty placeholder when destination was
  // empty. If the source is a parent-of-leftovers, caller has already
  // confirmed (see long-press handler) and we run `markLeftoversOnSwap`
  // before the move so totals stay right.
  const handleMove = useCallback(
    (from: { day: number; slotIndex: number }, to: { day: number; slotIndex: number }) => {
      if (from.day === to.day && from.slotIndex === to.slotIndex) return;
      setPlan((prev) => {
        if (!prev) return prev;
        const fromDp = prev.find((d) => d.day === from.day);
        const toDp = prev.find((d) => d.day === to.day);
        const fromSlot = fromDp?.meals[from.slotIndex]?.name ?? "";
        const toSlot = toDp?.meals[to.slotIndex]?.name ?? "";
        const next = moveMealInPlan(prev, from, to) as DayPlan[];
        track(AnalyticsEvents.meal_moved_in_plan, {
          fromSlot,
          toSlot,
          crossDay: from.day !== to.day,
        });
        // Fire-and-forget persist; UI already reflects the move.
        void persistPlan(next);
        return next;
      });
    },
    [persistPlan],
  );

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

  // Prototype port (2026-04-20): "Week of {Month Day}" overline.
  // Superseded the older getDateRange helper which built a
  // "Apr 20 – Apr 26" span; the new overline shows only the first
  // day of the plan to match the prototype (`screens-mobile.jsx` 455).
  // Shows the first day of the currently-displayed plan, honouring
  // startOffset so "Next week" doesn't still say today's date.
  const getWeekOfLabel = useCallback(() => {
    const d = planCalendarDateForIndex(0, startOffset);
    return `Week of ${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }, [startOffset]);

  // Prototype port — compute "Hits your targets N of 7 days" from the
  // live plan + targets. A day "hits" when its total calories sit
  // within ±10% of the daily calorie target. Worst-short day = the
  // day with the largest negative gap (most calories under).
  // Returns null if we don't have targets or plan data yet.
  const summaryScore = useMemo((): {
    hits: number;
    total: number;
    worstShort: { dayIndex: number; shortBy: number } | null;
  } | null => {
    if (!plan || plan.length === 0 || !planTargets || planTargets.calories <= 0) {
      return null;
    }
    const target = planTargets.calories;
    const tol = target * 0.1;
    let hits = 0;
    let worstShort: { dayIndex: number; shortBy: number } | null = null;
    plan.forEach((dp, idx) => {
      const total = dp.totals.calories;
      const diff = total - target;
      if (Math.abs(diff) <= tol) hits += 1;
      if (diff < 0) {
        const shortBy = -diff;
        if (!worstShort || shortBy > worstShort.shortBy) {
          worstShort = { dayIndex: idx, shortBy };
        }
      }
    });
    return { hits, total: plan.length, worstShort };
  }, [plan, planTargets]);

  // Helper to truncate meal names in day cards
  const truncateMealName = (name: string, maxLen: number = 12) => {
    return name.length > maxLen ? name.substring(0, maxLen - 1) + "…" : name;
  };

  // Determine progress bar color based on calorie percentage vs target
  const getProgressColor = (cals: number, target: number) => {
    if (target <= 0) return colors.border;
    const pct = (cals / target) * 100;
    if (pct > 105) return Accent.destructive; // Over target
    if (pct >= 95 && pct <= 105) return Accent.success; // Within ±5%
    if (pct >= 50) return Accent.warning; // Under but getting there
    return colors.border; // Way under
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 120, gap: Spacing.lg },
        // Prototype port — uppercase micro-overline above the big title.
        headerOverline: {
          fontSize: 11,
          fontWeight: "700",
          color: colors.textTertiary,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          paddingTop: 18,
        },
        headerTitle: {
          fontSize: 28,
          fontWeight: "700",
          color: colors.text,
          letterSpacing: -0.6,
          marginTop: 2,
          paddingBottom: 4,
        },
        headerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: Spacing.md,
          marginBottom: Spacing.md,
        },
        headerLeft: { flex: 1 },
        // Prototype port — round icon pill on the right of the header.
        // Replaces the old "Regenerate / Generate Plan" text button; the
        // Regenerate action moves into the summary card below.
        headerIconBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        },
        // Prototype-ported summary card. Gradient fallback = flat tint
        // (Accent.primary + "14") because expo-linear-gradient isn't
        // installed; switching to a true gradient only requires wrapping
        // the inner content in <LinearGradient> with the same two colours
        // the prototype uses (primary 12% → fat 8%).
        summaryCard: {
          backgroundColor: Accent.primary + "14",
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Accent.primary + "38",
          padding: Spacing.xl,
          marginBottom: Spacing.md,
        },
        summaryOverline: {
          fontSize: 11,
          fontWeight: "700",
          color: Accent.primaryLight,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 6,
        },
        summaryTitle: {
          fontSize: 17,
          fontWeight: "700",
          color: colors.text,
          letterSpacing: -0.2,
          marginBottom: 4,
        },
        summarySubtitle: {
          fontSize: 12,
          color: colors.textSecondary,
          lineHeight: 18,
          marginBottom: 14,
        },
        summaryActions: { flexDirection: "row", gap: 8 },
        summaryPrimaryBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: Accent.primary,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: Radius.md,
        },
        summaryPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
        summarySecondaryBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: Radius.md,
        },
        summarySecondaryText: { color: colors.text, fontSize: 13, fontWeight: "600" },

        dayCardsScroll: {
          marginHorizontal: -Spacing.xl,
          paddingHorizontal: Spacing.xl,
          marginBottom: Spacing.sm,
          gap: Spacing.sm,
          flexGrow: 0,
        },
        dayCardsSingleWrap: {
          marginBottom: Spacing.sm,
        },
        dayCard: {
          width: 108,
          minHeight: 128,
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          alignItems: "center",
          gap: Spacing.xs,
        },
        dayCardFull: {
          width: "100%" as const,
          alignSelf: "stretch",
          minHeight: 132,
        },
        dayCardToday: { borderColor: Accent.primary, backgroundColor: Accent.primary + "08" },
        dayCardName: { fontSize: 13, fontWeight: "600", color: colors.text },
        dayCardNameToday: { color: Accent.primary },
        dayCardMeals: { gap: 2 },
        dayCardMeal: { fontSize: 10, color: colors.textTertiary, lineHeight: 12 },
        dayCardProgressBar: { width: "100%", height: 3, backgroundColor: colors.border, borderRadius: 1.5, marginVertical: Spacing.xs },
        dayCardProgressFill: { height: 3, borderRadius: 1.5 },
        dayCardCalories: { fontSize: 10, color: colors.textTertiary, fontVariant: ["tabular-nums"] },

        sectionLabel: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.textSecondary,
          letterSpacing: 0.2,
          marginTop: Spacing.sm,
          marginBottom: Spacing.xs,
        },

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
        // Prototype port (2026-04-20) — small uppercase "TODAY" pill
        // next to the weekday label. Primary-color text, no pill
        // background — matches prototype `screens-mobile.jsx:482`.
        dayTodayPill: {
          fontSize: 10,
          fontWeight: "700",
          color: Accent.primary,
          letterSpacing: 1.4,
        },
        dayTotals: { fontSize: 12, color: colors.textSecondary, fontVariant: ["tabular-nums"] },

        mealRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: Spacing.sm,
        },
        // Prototype port (2026-04-20) — 36×36 muted square on the
        // left of every meal row carrying a slot-appropriate icon.
        mealIconBox: {
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.border + "66",
          alignItems: "center",
          justifyContent: "center",
        },
        mealSlot: { fontSize: 11, fontWeight: "700", color: Accent.primary, letterSpacing: 1 },
        mealTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 4, lineHeight: 21 },
        mealMacros: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontVariant: ["tabular-nums"] },
        // Prototype port (2026-04-20) — 30×30 square swap button. Sits
        // immediately before the existing "Log today" button (both
        // right-aligned). Tapping opens the same swap flow the row's
        // long-press alert offers; visible entry point.
        mealSwapBtn: {
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: colors.border + "66",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 3,
        },
        mealLogBtn: { paddingVertical: 12, paddingHorizontal: 10, minWidth: 64, alignItems: "flex-end" },
        mealLogBtnText: { fontSize: 12, fontWeight: "700", color: Accent.primary, textAlign: "right" },
        mealChevron: { color: colors.tabIconDefault, fontSize: 20, fontWeight: "600", marginTop: 2 },

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
            const meals = stripPlanPlaceholders(
              (mealsByDay.get(d.id) ?? []).map((m) => ({
              name: (m.name as string) ?? "",
              recipeTitle: (m.recipe_title as string) ?? "",
              calories: (m.calories as number) ?? 0,
              protein: (m.protein as number) ?? 0,
              carbs: (m.carbs as number) ?? 0,
              fat: (m.fat as number) ?? 0,
              portionMultiplier: (m.portion_multiplier as number) ?? 1,
              isPlaceholder: (m.is_placeholder as boolean) || undefined,
            })),
            );
            const totals = meals.reduce(
              (acc, ml) => ({
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

      if (!cancelled) {
        const planJson = await fetchMealPlanJson(supabase, userId);
        if (!cancelled && planJson != null && Array.isArray(planJson)) {
          const cleaned = (planJson as DayPlan[]).map((dp) => {
            const meals = stripPlanPlaceholders(dp.meals);
            const totals = meals.reduce(
              (acc, ml) => ({
                calories: acc.calories + ml.calories,
                protein: acc.protein + ml.protein,
                carbs: acc.carbs + ml.carbs,
                fat: acc.fat + ml.fat,
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 },
            );
            return { ...dp, meals, totals };
          });
          setPlan(cleaned);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const generatePlan = useCallback(async () => {
    if (savedRecipes.length === 0 && discoverRecipes.length === 0) {
      Alert.alert("No recipes available", "Save at least 1 recipe from Discover to generate a plan.");
      return;
    }

    setGenerating(true);

    // Smart macro-aware plan generation
    {
      // Load targets from user profile
      let resolved = { calories: NUTRITION_DEFAULTS.calories, protein: NUTRITION_DEFAULTS.protein, carbs: NUTRITION_DEFAULTS.carbs, fat: NUTRITION_DEFAULTS.fat, fiber: NUTRITION_DEFAULTS.fiber };
      if (userId) {
        const { data } = await supabase
          .from("profiles")
          .select("target_calories, target_protein, target_carbs, target_fat, target_fiber_g, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace")
          .eq("id", userId)
          .single();
        if (data) {
          const d = data as any;
          const t = resolveTargets(
            { target_calories: d.target_calories, target_protein: d.target_protein, target_carbs: d.target_carbs, target_fat: d.target_fat, target_fiber_g: d.target_fiber_g },
            {
              weight_kg: d.weight_kg,
              height_cm: d.height_cm,
              sex: d.sex,
              activity_level: d.activity_level,
              goal: d.goal,
              dob: d.dob,
              age: d.age != null ? Number(d.age) : null,
              plan_pace: d.plan_pace,
            },
          );
          resolved = { calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, fiber: t.fiber };
        }
      }

      const targets: PlannerTargets = {
        calories: resolved.calories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fat: resolved.fat,
        calorieBandPct: 5,
        carbFatBandPct: 15,
      };
      if (__DEV__) console.log("[planner] targets:", targets);

      // Use saved recipes first, then fill with discover recipes if the user doesn't
      // have enough variety to populate all meal slots.
      const savedPool = savedRecipes.map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        fiberG: (r as any).fiber_g ?? (r as any).fiberG ?? 0,
        mealType: r.mealSlots ?? null,
      }));
      const discoverPool = discoverRecipes
        .filter((r) => !savedRecipes.some((s) => s.id === r.id))
        .map((r) => ({
          id: r.id,
          title: r.title,
          calories: r.calories,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
          mealType: (r as any).mealSlots ?? null,
        }));
      const fullPool = [...savedPool, ...discoverPool];
      const recipePool = savedPool.length >= 6 ? savedPool : fullPool;

      const rawPlan = generateSmartPlan({
        recipes: recipePool,
        targets,
        days,
        slotConfig: { slots: ALL_MEAL_SLOTS.filter((s) => enabledSlots.has(s)) },
      });
      const stripped = rawPlan.map((dp) => {
        const meals = stripPlanPlaceholders(dp.meals);
        const totals = meals.reduce(
          (acc, ml) => ({
            calories: acc.calories + ml.calories,
            protein: acc.protein + ml.protein,
            carbs: acc.carbs + ml.carbs,
            fat: acc.fat + ml.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
        return { ...dp, meals, totals };
      });

      // Batch 3.10 — leftovers pass using recipe `servings` yield.
      const recipesByRef: Record<string, { servings: number }> = {};
      for (const r of savedRecipes) {
        const s = (r as { servings?: number }).servings;
        if (s && s > 1) recipesByRef[r.id] = { servings: s };
      }
      let newPlan: DayPlan[] = stripped as DayPlan[];
      if (Object.keys(recipesByRef).length > 0) {
        const { plan: distributed, parentCount, leftoverCount } = distributeLeftovers(
          stripped as DayPlan[],
          recipesByRef,
        );
        newPlan = distributed as DayPlan[];
        if (leftoverCount > 0) {
          track(AnalyticsEvents.plan_leftovers_generated, { parentCount, leftoverCount });
        }
      }

      setPlan(newPlan);
      setPlanTargets(resolved);
      setGenerating(false);

      // G-2 (TestFlight `ALU8hrB1I9Sn4ysqoR_ocEs`, 2026-04-19):
      // regenerate must purge the previous plan's `shopping_items`
      // rows. The lifecycle effect at line ~207 only fires on plan
      // → null; regenerate stays truthy, so old rows survived and
      // re-hydrated on next shopping-screen mount. The "Generate
      // Shopping List" flow further below already purges — but
      // Regenerate is the primary path on mobile and can't depend
      // on the user tapping that button again. Fire-and-forget; the
      // shopping screen will rebuild from the fresh plan next time
      // the user opens it.
      if (userId) {
        void supabase.from("shopping_items").delete().eq("user_id", userId);
        setShoppingItemCount(0);
      }

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
            void upsertMealPlanJson(supabase, userId, newPlan);
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
        {/* Prototype port (2026-04-20) — overline + big title on the
            left, round "options" pill on the right. The old inline
            Regenerate/Generate-Plan text button was moved: the
            "Regenerate" primary action now lives in the summary card
            below for plans that already exist; the "Generate Plan"
            empty-state CTA is still served by the generate controls
            card further down (unchanged). The round button currently
            re-uses the templates sheet as its "plan options" surface;
            if a standalone filter/options sheet ships later, swap the
            onPress target. */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerOverline}>{getWeekOfLabel()}</Text>
            <Text style={styles.headerTitle}>Meal plan</Text>
          </View>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => setTemplatesOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Plan options"
          >
            <Ionicons name="options-outline" size={18} color={colors.text} />
          </Pressable>
        </View>

        {/* Named plan slots — mobile parity for web's "Named plans"
            switcher (`MealPlanner.tsx` 679). Horizontal scrollable
            row of pills, one per slot, plus a "+ New" affordance.
            Long-press a pill for rename / delete. Cloud syncs only
            the active slot's plan; slot names + ids stay device-local. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 4, paddingRight: 4 }}
          style={{ marginBottom: Spacing.md }}
        >
          {planSlots.map((s) => {
            const active = s.id === activePlanSlotId;
            return (
              <Pressable
                key={s.id}
                onPress={() => switchPlanSlot(s.id)}
                onLongPress={() => {
                  Alert.alert(
                    s.name,
                    "Rename or delete this plan?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Rename",
                        onPress: () => {
                          Alert.prompt(
                            "Rename plan",
                            "Choose a new name for this plan slot.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Save",
                                onPress: (next?: string) => {
                                  if (next && next.trim()) renamePlanSlot(s.id, next);
                                },
                              },
                            ],
                            "plain-text",
                            s.name,
                          );
                        },
                      },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          if (planSlots.length <= 1) {
                            Alert.alert("Can't delete", "You need at least one plan slot.");
                            return;
                          }
                          Alert.alert(
                            "Delete plan?",
                            `"${s.name}" will be removed from this device. Other devices keep their copy.`,
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Delete", style: "destructive", onPress: () => deletePlanSlot(s.id) },
                            ],
                          );
                        },
                      },
                    ],
                  );
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? Accent.primary : colors.border,
                  backgroundColor: active ? Accent.primary + "1A" : colors.card,
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Plan: ${s.name}${active ? ", active" : ""}. Long-press to rename or delete.`}
              >
                {active ? (
                  <Ionicons name="checkmark" size={11} color={Accent.primary} />
                ) : null}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: active ? "700" : "500",
                    color: active ? Accent.primary : colors.textSecondary,
                  }}
                >
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              Alert.prompt(
                "New plan",
                "Name this plan (e.g. \"Cut week\", \"Family dinners\").",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Create",
                    onPress: (name?: string) => {
                      const trimmed = (name ?? "").trim();
                      if (trimmed) createPlanSlot(trimmed);
                    },
                  },
                ],
                "plain-text",
                "",
              );
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              borderStyle: "dashed",
              backgroundColor: "transparent",
            }}
            accessibilityRole="button"
            accessibilityLabel="Create a new plan slot"
          >
            <Ionicons name="add" size={12} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textSecondary }}>New</Text>
          </Pressable>
        </ScrollView>

        {/* Prototype port (2026-04-20) — weekly summary card.
            Rendered only when we have both a plan and resolved targets.
            - "Hits your targets N of 7 days" counts days whose total
              calories sit within ±10% of the user's daily calorie
              target (see `summaryScore`).
            - Subtitle diagnoses the worst-short day when N < planLen;
              shows a clean "all days land on target" line when N === planLen.
            - Shopping list button routes to the same destination as the
              Shopping list CTA card further down (`/shopping`).
            - Regenerate reuses the existing `generatePlan` used by the
              empty-state Generate Plan button. */}
        {plan && plan.length > 0 && planTargets && summaryScore && (
          <View style={styles.summaryCard} testID="plan-summary-card">
            <Text style={styles.summaryOverline}>This week</Text>
            <Text style={styles.summaryTitle}>
              Hits your targets {summaryScore.hits} of {summaryScore.total} day{summaryScore.total === 1 ? "" : "s"}
            </Text>
            <Text style={styles.summarySubtitle}>
              {summaryScore.hits === summaryScore.total
                ? `All ${summaryScore.total} day${summaryScore.total === 1 ? "" : "s"} land on target.`
                : summaryScore.worstShort
                  ? `${WEEKDAY_LONG[planCalendarDateForIndex(summaryScore.worstShort.dayIndex, startOffset).getDay()]} is ~${Math.round(summaryScore.worstShort.shortBy)} kcal short. Add a snack or swap the dinner.`
                  : "Some days run over target. Tap a meal to swap or adjust the portion."}
            </Text>
            <View style={styles.summaryActions}>
              <Pressable
                style={styles.summaryPrimaryBtn}
                onPress={() => router.push("/shopping")}
                accessibilityRole="button"
                accessibilityLabel="Open shopping list"
              >
                <Ionicons name="cart-outline" size={14} color="#fff" />
                <Text style={styles.summaryPrimaryText}>Shopping list</Text>
              </Pressable>
              <Pressable
                style={styles.summarySecondaryBtn}
                onPress={generatePlan}
                disabled={generating}
                accessibilityRole="button"
                accessibilityLabel="Regenerate plan"
              >
                {generating ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={14} color={colors.text} />
                    <Text style={styles.summarySecondaryText}>Regenerate</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Household shared meals. Positioned BELOW the "This week"
            summary card (2026-04-20 prototype port) so the weekly
            at-a-glance copy is the first thing a user sees after the
            pills row; the household surface is secondary. */}
        <HouseholdCard />

        {/* Day summary strip — compact row that fits on screen */}
        {plan && plan.length > 1 && planTargets && (
          <View style={{ flexDirection: "row", gap: 6, marginBottom: Spacing.md }}>
            {plan.map((dp, idx) => {
              const cal = planCalendarDateForIndex(idx, startOffset);
              const isTodayCard = dateKeyFromDate(cal) === dateKeyFromDate(stripMidnight(new Date()));
              const progressPct = planTargets.calories > 0 ? Math.min((dp.totals.calories / planTargets.calories) * 100, 100) : 0;
              const progressColor = getProgressColor(dp.totals.calories, planTargets.calories);
              return (
                <View
                  key={dp.day}
                  style={{
                    flex: 1,
                    backgroundColor: isTodayCard ? Accent.primary + "08" : colors.card,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: isTodayCard ? Accent.primary : colors.border,
                    padding: 8,
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isTodayCard ? Accent.primary : colors.text }}>
                    {WEEKDAY_SHORT[cal.getDay()]}
                  </Text>
                  <View style={{ width: "100%", height: 3, borderRadius: 1.5, backgroundColor: colors.border }}>
                    <View style={{ width: `${progressPct}%` as any, height: 3, borderRadius: 1.5, backgroundColor: progressColor }} />
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                    {Math.round(dp.totals.calories)}
                  </Text>
                </View>
              );
            })}
          </View>
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
                        Alert.alert("Upgrade required", "Plan your full week and generate a ready-to-shop list. Available on Base and above.", [
                          { text: "Continue for free", style: "cancel" },
                          { text: "See plans", onPress: () => router.push("/paywall?from=meal_planner" as any) },
                        ]);
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

            {/* Start date */}
            <Text style={styles.sectionLabel}>Start from</Text>
            <View style={styles.daysRow}>
              {([
                { val: 0 as const, label: "Today" },
                { val: 1 as const, label: "Tomorrow" },
                { val: 7 as const, label: "Next week" },
              ]).map((o) => (
                <Pressable
                  key={o.val}
                  style={[styles.dayBtn, startOffset === o.val && styles.dayBtnActive]}
                  onPress={() => setStartOffset(o.val)}
                >
                  <Text style={[styles.dayBtnText, startOffset === o.val && styles.dayBtnTextActive]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Meal slot toggles */}
            <Text style={styles.sectionLabel}>Include meals</Text>
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

        {plan && plan.length > 0 && (
          <Text style={styles.sectionLabel}>
            {plan.length === 1
              ? `${WEEKDAY_LONG[planCalendarDateForIndex(0, startOffset).getDay()]}'s plan`
              : `Your ${plan.length}-day plan`}
          </Text>
        )}

        {/* Plan display */}
        {plan && plan.map((dp, dayIdx) => {
          // Build-12 H-5 (TestFlight `AH8csBqtZsBJJr0uHgXyEcE`,
          // 2026-04-19): "Plan doesn't tell me how close it is to my
          // macro targets." The shared helper builds an explicit
          // "Day total · X / Y kcal · P / C / F" line with symmetric
          // ±10% / ±20% tolerance bands. Totals respect per-meal
          // portionMultiplier via dayPlanTotalsFromMeals. When the
          // user has no goals yet (hasTargets=false) we omit the line
          // entirely — never show "—". `planTargets` falsy → skip
          // the helper too (gate belt-and-braces).
          const goalLine = planTargets
            ? buildDayTotalVsGoalLine(dp.meals, {
                calories: planTargets.calories,
                protein: planTargets.protein,
                carbs: planTargets.carbs,
                fat: planTargets.fat,
              })
            : null;
          const toneColor = (tone: DayTotalTone): string =>
            tone === "neutral"
              ? colors.textSecondary
              : tone === "amber"
                ? Accent.warning
                : Accent.destructive;
          // Prototype port (2026-04-20) — day total surfaces as
          // "1,820 kcal" (thousands-separator, right-aligned) in the
          // day header. Sum from non-placeholder meals so cleared
          // slots don't drag the number to 0 when other meals are
          // present; also omits leftover-companion rows implicitly
          // because those still carry macros and belong in the total.
          const dayTotalKcal = dp.meals
            .filter((m) => !m.isPlaceholder && !!m.recipeTitle)
            .reduce((sum, m) => sum + (m.calories || 0), 0);
          // Prototype port (2026-04-20) — day section header reads
          // "Mon" / "Tue" / "Wed" (3-letter weekday) instead of
          // "Day 1". When the day card maps to today, show an
          // uppercase "TODAY" pill next to the weekday. Uses the
          // shared `planDayLabel` helpers so web + mobile pick the
          // same weekday off the same (idx, startOffset) inputs.
          const dayCal = planCalendarDateForIndex(dayIdx, startOffset);
          const weekdayLabel = shortWeekdayLabel(dayCal);
          const isTodayRow = isSameCalendarDay(dayCal);
          return (
          <View key={dp.day} style={styles.card}>
            <View style={styles.dayHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.dayTitle}>{weekdayLabel}</Text>
                {isTodayRow && (
                  <Text
                    accessibilityLabel="Today"
                    style={styles.dayTodayPill}
                  >
                    TODAY
                  </Text>
                )}
              </View>
              <Text style={styles.dayTotals}>{Math.round(dayTotalKcal).toLocaleString("en-US")} kcal</Text>
            </View>
            {goalLine && goalLine.hasTargets && (
              <View
                accessibilityRole="text"
                accessibilityLabel={`Day total ${Math.round(goalLine.totals.calories)} of ${planTargets!.calories} kcal, protein ${Math.round(goalLine.totals.protein)} of ${planTargets!.protein} grams, carbs ${Math.round(goalLine.totals.carbs)} of ${planTargets!.carbs} grams, fat ${Math.round(goalLine.totals.fat)} of ${planTargets!.fat} grams`}
                style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 2, marginBottom: 6 }}
                testID={`day-total-vs-goal-${dp.day}`}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginRight: 4 }}>
                  Day total
                </Text>
                {goalLine.cells.map((cell) => (
                  <Text
                    key={cell.key}
                    style={{
                      fontSize: 12,
                      fontVariant: ["tabular-nums"],
                      color: toneColor(cell.tone),
                    }}
                  >
                    {" · "}
                    {formatDayTotalCell(cell)}
                  </Text>
                ))}
              </View>
            )}
            {planTargets && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                {([
                  { label: "P", val: dp.totals.protein, target: planTargets.protein, color: MacroColors.protein },
                  { label: "C", val: dp.totals.carbs, target: planTargets.carbs, color: MacroColors.carbs },
                  { label: "F", val: dp.totals.fat, target: planTargets.fat, color: MacroColors.fat },
                  { label: "Fi", val: Math.round(dp.meals.reduce((s, m) => s + (m.fiberG ?? 0), 0) * 10) / 10, target: planTargets.fiber ?? 28, color: Accent.success },
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
            {/* F-15 — residual protein gap hint (web/mobile parity). Only
                rendered when the joint-fit scaler left this day more than
                10g under the protein target. Points at the lowest-protein
                slot so the user can act: tap the meal row to open the
                portion / swap action sheet. */}
            {(() => {
              const gap = dp.residualProteinGap;
              if (gap == null || gap >= -10) return null;
              const scorable = dp.meals.filter((m) => !m.isPlaceholder && !!m.recipeTitle);
              if (scorable.length === 0) return null;
              const lowest = scorable.reduce((low, m) => (m.protein < low.protein ? m : low), scorable[0]!);
              const under = Math.abs(gap);
              return (
                <Text
                  accessibilityRole="text"
                  accessibilityLabel={`Protein ${under} grams under target. Scale ${lowest.name} up or swap to a higher-protein recipe.`}
                  style={{ fontSize: 12, color: Accent.warning, marginTop: 4, marginBottom: 4, lineHeight: 16 }}
                  testID="residual-protein-gap-hint"
                >
                  Protein {under}g under target — try scaling {lowest.name} up or swap to a higher-protein recipe.
                </Text>
              );
            })()}

            {dp.meals.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.textSecondary, paddingVertical: Spacing.md }}>
                No meals for this day. Generate again after saving recipes that match each slot, or pick a shorter day range.
              </Text>
            ) : null}
            {[...dp.meals].sort((a, b) => {
              // Slot order parity with Today: Breakfast → Lunch → Dinner → Snacks.
              const order: Record<PlanSlotIconKey, number> = { breakfast: 0, lunch: 1, dinner: 2, snacks: 3 };
              return order[resolvePlanSlotIconKey(a.name)] - order[resolvePlanSlotIconKey(b.name)];
            }).map((meal, i) => (
              <Pressable
                key={i}
                style={styles.mealRow}
                delayLongPress={400}
                onLongPress={() => {
                  // Batch 3.10 mobile parity (2026-04-18 audit C2).
                  // Long-press → action sheet with Move / Swap / Delete / Cancel.
                  // Factual copy, no shame.
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const isPlaceholder = !meal.recipeTitle || meal.isPlaceholder;
                  const sourceDay = plan?.[dayIdx]?.day;
                  if (sourceDay == null) return;
                  Alert.alert(
                    meal.recipeTitle || "Empty slot",
                    isPlaceholder
                      ? "No meal in this slot."
                      : `${Math.round(meal.calories)} kcal · ${meal.name}`,
                    [
                      {
                        text: "Move to another slot…",
                        onPress: () => {
                          if (isPlaceholder) {
                            Alert.alert("Nothing to move", "This slot is empty.");
                            return;
                          }
                          // If this meal is a parent of downstream leftovers,
                          // factually confirm the N we'll clear before the move.
                          const rid = meal.recipeId;
                          const leftoverCount =
                            rid && plan ? countLeftoversOfRecipe(plan, rid) : 0;
                          const openSheet = () => {
                            setMoveSource({ day: sourceDay, slotIndex: i });
                            setMoveSheetOpen(true);
                          };
                          if (leftoverCount > 0 && rid && plan) {
                            Alert.alert(
                              "Move meal",
                              `This will remove ${leftoverCount} leftover meal${leftoverCount === 1 ? "" : "s"}.`,
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Continue",
                                  onPress: () => {
                                    setPlan((prev) => {
                                      if (!prev) return prev;
                                      const dayIndexInArr = prev.findIndex(
                                        (d) => d.day === sourceDay,
                                      );
                                      const { plan: cleaned } = markLeftoversOnSwap(prev, {
                                        dayIndex: dayIndexInArr,
                                        slot: meal.name,
                                        previousRecipeId: rid,
                                      });
                                      return cleaned as DayPlan[];
                                    });
                                    openSheet();
                                  },
                                },
                              ],
                            );
                          } else {
                            openSheet();
                          }
                        },
                      },
                      {
                        text: "Swap with another meal…",
                        onPress: () => {
                          if (isPlaceholder) {
                            Alert.alert("Nothing to swap", "This slot is empty.");
                            return;
                          }
                          swapMeal(dayIdx, i, meal.name);
                        },
                      },
                      ...(isPlaceholder
                        ? []
                        : [
                            {
                              text: "Delete",
                              style: "destructive" as const,
                              onPress: () => {
                                setPlan((prev) => {
                                  if (!prev) return prev;
                                  const next = prev.map((dpRow, di) => {
                                    if (di !== dayIdx) return dpRow;
                                    const newMeals = dpRow.meals.map((m, mi) => {
                                      if (mi !== i) return m;
                                      return {
                                        name: m.name,
                                        recipeTitle: "",
                                        calories: 0,
                                        protein: 0,
                                        carbs: 0,
                                        fat: 0,
                                        isPlaceholder: true,
                                      } as PlanMeal;
                                    });
                                    const totals = newMeals.reduce(
                                      (a, m) => ({
                                        calories: a.calories + m.calories,
                                        protein: a.protein + m.protein,
                                        carbs: a.carbs + m.carbs,
                                        fat: a.fat + m.fat,
                                      }),
                                      { calories: 0, protein: 0, carbs: 0, fat: 0 },
                                    );
                                    return { ...dpRow, meals: newMeals, totals };
                                  });
                                  void persistPlan(next);
                                  return next;
                                });
                              },
                            },
                          ]),
                      { text: "Cancel", style: "cancel" },
                    ],
                  );
                }}
                onPress={() => {
                  const currentMult = meal.portionMultiplier ?? 1;
                  Alert.alert(
                    meal.recipeTitle,
                    `${Math.round(meal.calories)} kcal · ${currentMult}x portion`,
                    [
                      {
                        text: "Swap meal",
                        onPress: () => swapMeal(dayIdx, i, meal.name),
                      },
                      {
                        text: "Adjust portion",
                        onPress: () => {
                          Alert.alert("Portion", "Choose a portion size:", [
                            ...[0.5, 0.75, 1, 1.25, 1.5, 2].map((mult) => ({
                              text: `${mult}x (${Math.round(meal.calories / currentMult * mult)} kcal)`,
                              onPress: () => {
                                setPlan((prev) => {
                                  if (!prev) return prev;
                                  return prev.map((dp, di) => {
                                    if (di !== dayIdx) return dp;
                                    const baseCals = meal.calories / currentMult;
                                    const basePro = meal.protein / currentMult;
                                    const baseCarbs = meal.carbs / currentMult;
                                    const baseFat = meal.fat / currentMult;
                                    const baseFiber = (meal.fiberG ?? 0) / currentMult;
                                    const newMeals = dp.meals.map((m, mi) => {
                                      if (mi !== i) return m;
                                      return {
                                        ...m,
                                        calories: Math.round(baseCals * mult),
                                        protein: Math.round(basePro * mult),
                                        carbs: Math.round(baseCarbs * mult),
                                        fat: Math.round(baseFat * mult),
                                        fiberG: Math.round(baseFiber * mult * 10) / 10,
                                        portionMultiplier: mult !== 1 ? mult : undefined,
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
                            })),
                            { text: "Cancel", style: "cancel" },
                          ]);
                        },
                      },
                      {
                        text: "View recipe",
                        onPress: () => {
                          const id = meal.recipeId ?? savedRecipes.find((x) => x.title === meal.recipeTitle)?.id ?? discoverRecipes.find((x) => x.title === meal.recipeTitle)?.id;
                          if (id) router.push(`/recipe/${id}?portion=${currentMult}`);
                        },
                      },
                      { text: "Cancel", style: "cancel" },
                    ],
                  );
                }}
              >
                {/* Prototype port (2026-04-20) — 36×36 slot icon-box on
                    the left. Key resolves via shared `resolvePlanSlotIconKey`
                    so legacy / voice-parsed slot text still lands on a
                    sensible icon. Mobile maps the key to Ionicons;
                    web maps to lucide-react (see `SLOT_ICON_MOBILE` +
                    `SLOT_ICON_WEB` — the single source of truth is the
                    shared key). */}
                {(() => {
                  const slotKey = resolvePlanSlotIconKey(meal.name);
                  const ic = SLOT_ICON_MOBILE[slotKey];
                  const tint = SLOT_COLOR_MOBILE[slotKey];
                  return (
                    <View style={[styles.mealIconBox, { backgroundColor: tint + "22" }]}>
                      {ic.family === "ionicons" ? (
                        <Ionicons name={ic.name} size={16} color={tint} />
                      ) : (
                        <MaterialCommunityIcons name={ic.name} size={16} color={tint} />
                      )}
                    </View>
                  );
                })()}
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealSlot}>{meal.name}</Text>
                  {(meal as LeftoverAwareMeal).leftoverOf ? (
                    <Badge
                      variant="leftover"
                      accessibilityLabel={`Leftover of ${meal.recipeTitle}`}
                      icon={<Text>🍱</Text>}
                      style={{ marginTop: 4 }}
                    >
                      Leftover of {meal.recipeTitle}
                    </Badge>
                  ) : null}
                  {/* Prototype port (2026-04-20): placeholders still
                      render a title + macro line so every meal row has
                      the same visual weight. Empty slots read
                      "Empty slot" · "— kcal · P —g · C —g · F —g"
                      instead of going blank. The existing kcal/macros
                      line (already present for real meals) stays
                      unchanged — no duplication. */}
                  <Text style={styles.mealTitle}>
                    {meal.isPlaceholder || !meal.recipeTitle
                      ? "Empty slot"
                      : `${meal.recipeTitle}${meal.portionMultiplier && meal.portionMultiplier !== 1 ? ` (${meal.portionMultiplier}x)` : ""}`}
                  </Text>
                  <Text style={styles.mealMacros}>
                    {meal.isPlaceholder || !meal.recipeTitle
                      ? "— kcal · P —g · C —g · F —g"
                      : `${Math.round(meal.calories)} kcal · P ${Math.round(meal.protein)}g · C ${Math.round(meal.carbs)}g · F ${Math.round(meal.fat)}g`}
                  </Text>
                </View>
                {/* Swap shortcut — prototype-port (2026-04-20). 30×30
                    square button that opens the same swap alert the
                    row's `onPress` already offers; surfaces the swap
                    action visibly instead of hiding it behind a
                    tap-anywhere menu. Placeholder / empty slots also
                    trigger the swap picker (it's how you fill them). */}
                <Pressable
                  hitSlop={6}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    swapMeal(dayIdx, i, meal.name);
                  }}
                  style={styles.mealSwapBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Swap ${meal.name}`}
                >
                  <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
                </Pressable>
                {/* Log to tracker — Suppr-specific action kept next to
                    the swap button (the prototype omits Log). */}
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
                      // F-2 — snapshot today's target on first log.
                      void snapshotDailyTargetIfMissing(supabase, userId);
                      Alert.alert("Logged", `${meal.recipeTitle} added to today's tracker.`);
                    }
                  }}
                  style={styles.mealLogBtn}
                >
                  <Text style={styles.mealLogBtnText}>Log today</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
          );
        })}

        {/* Shopping list CTA card removed 2026-04-20 per Grace's
            review — "This week" summary card already carries the
            primary "Shopping list" button; keeping this card below
            was visual duplication. */}

        {/* Actions row removed 2026-04-20 per Grace's review — the
            summary card above carries Shopping list + Regenerate.
            "New plan" + "Templates" still reachable via the options
            pill in the header. Leaving `plan && false` to keep the
            JSX tree valid while preserving the branch structure for
            future iteration; dead block is collapsed via `false`. */}
        {false && plan && (
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.generateBtn}
              onPress={async () => {
                if (!userId || !plan) return;
                setGenerating(true);
                try {
                  // Collect recipe IDs from plan meals
                  const allRecipes = [...savedRecipes, ...discoverRecipes];
                  const recipeIds: string[] = [];
                  for (const dp of plan) {
                    for (const m of dp.meals) {
                      const rid = m.recipeId ?? allRecipes.find((r) => r.title === m.recipeTitle)?.id;
                      if (rid && !recipeIds.includes(rid)) recipeIds.push(rid);
                    }
                  }
                  if (__DEV__) console.log("[shopping] Recipe IDs from plan:", recipeIds.length, recipeIds);
                  if (recipeIds.length === 0) {
                    const mealTitles = plan.flatMap((dp) => dp.meals.map((m) => `${m.recipeTitle} (id: ${m.recipeId ?? "none"})`));
                    Alert.alert("No recipe IDs found", `Meals in plan:\n${mealTitles.join("\n")}\n\nGenerate a new plan to fix this.`);
                    setGenerating(false);
                    return;
                  }

                  // Fetch ingredients for all planned recipes
                  const { data: ingredients, error: ingErr } = await supabase
                    .from("recipe_ingredients")
                    .select("name, amount, unit, recipe_id")
                    .in("recipe_id", recipeIds);

                  if (__DEV__) console.log("[shopping] Ingredients fetched:", ingredients?.length ?? 0, ingErr?.message ?? "ok");
                  if (ingErr) {
                    Alert.alert("Error", "Couldn't fetch ingredients: " + ingErr.message);
                    setGenerating(false);
                    return;
                  }
                  if (!ingredients || ingredients.length === 0) {
                    Alert.alert("No ingredients found", `Looked up ${recipeIds.length} recipe(s) but none had ingredient data.\n\nThis can happen with community recipes that haven't been verified yet. Try re-importing or verifying the recipes first.`);
                    setGenerating(false);
                    return;
                  }

                  // Count how many times each recipe appears in the plan.
                  // Batch 3.10 — leftover rows represent servings of an already-counted
                  // parent recipe. Skip them so the shopping list doesn't triple-buy
                  // ingredients for a single batch cook.
                  const recipeCounts: Record<string, number> = {};
                  const recipeTitles: Record<string, string> = {};
                  for (const dp of plan) {
                    for (const m of dp.meals) {
                      if ((m as PlanMeal).leftoverOf) continue;
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

                  const items = [...merged.values()].map((item) => ({
                    name: item.name,
                    amount: item.amount % 1 === 0 ? String(item.amount) : item.amount.toFixed(1),
                    unit: item.unit,
                    category: categorise(item.name),
                    checked: false,
                    source: [...item.from].filter(Boolean).join(", "),
                  }));

                  items.sort((a, b) => a.category.localeCompare(b.category));
                  if (__DEV__) console.log("[shopping] Merged items:", items.length, items.slice(0, 3));

                  // Build inserts — omit id so Supabase auto-generates UUIDs
                  const inserts = items.map((item) => ({
                    user_id: userId,
                    name: item.name,
                    amount: item.amount,
                    unit: item.unit,
                    category: item.category,
                    checked: item.checked,
                    source: item.source,
                  }));
                  // Clear existing then insert
                  // Clear existing items then insert new ones
                  const { error: delErr } = await supabase.from("shopping_items").delete().eq("user_id", userId!);
                  if (delErr) {
                    console.log("[planner] shopping_items delete failed, trying legacy:", delErr.message);
                    // Relational table doesn't exist — try legacy JSONB fallback
                    const { error: upErr } = await upsertShoppingListJsonItems(supabase, userId!, items);
                    if (upErr) throw new Error(upErr.message);
                  } else if (inserts.length > 0) {
                    // Insert in batches of 50 to avoid payload limits
                    for (let i = 0; i < inserts.length; i += 50) {
                      const batch = inserts.slice(i, i + 50);
                      const { error: insErr } = await supabase.from("shopping_items").insert(batch);
                      if (insErr) {
                        console.error("[planner] shopping_items insert failed:", insErr.message, JSON.stringify(batch[0]));
                        throw new Error(insErr.message);
                      }
                    }
                  }

                  if (inserts.length === 0) {
                    Alert.alert("Empty list", "Ingredients were found but none had quantities to add to a shopping list.");
                    setGenerating(false);
                    return;
                  }
                  setShoppingItemCount(inserts.length);
                  setGenerating(false);
                  Alert.alert(
                    "Shopping list ready",
                    `${inserts.length} item${inserts.length !== 1 ? "s" : ""} from ${plan.flatMap(d => d.meals).length} meals.`,
                    [
                      { text: "View list", onPress: () => router.push("/shopping") },
                      { text: "Stay here", style: "cancel" },
                    ],
                  );
                } catch (e) {
                  setGenerating(false);
                  Alert.alert("Error", `Failed to generate shopping list: ${e instanceof Error ? e.message : "Unknown error"}`);
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
            <Pressable
              style={styles.regenBtn}
              onPress={() => setTemplatesOpen(true)}
              accessibilityLabel="Save or apply a plan template"
            >
              <Text style={styles.regenBtnText}>Templates</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      <PlanTemplatesSheet
        visible={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        sourceMealCount={(plan ?? []).reduce(
          (n, d) =>
            n +
            d.meals.filter(
              (m) =>
                !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }) &&
                !(m as LeftoverAwareMeal).leftoverOf,
            ).length,
          0,
        )}
        maxDayCount={(plan ?? []).length || 1}
        templates={planTemplates}
        loading={templatesLoading}
        onSave={async (name, dayCount) => {
          if (!userId) return { ok: false, error: "Sign in to save templates." };
          const draft = buildTemplateFromWeek(plan, name, dayCount);
          if (!draft) return { ok: false, error: "This plan has no meals to save." };
          const { template, error } = await createPlanTemplate(supabase, userId, draft);
          if (error || !template) return { ok: false, error: error ?? "Could not save template." };
          track(AnalyticsEvents.plan_template_created, {
            dayCount: draft.dayCount,
            slotCount: draft.slots.length,
          });
          setPlanTemplates((prev) => [template, ...prev.filter((t) => t.id !== template.id)]);
          return { ok: true };
        }}
        onApply={(templateId) => {
          const tmpl = planTemplates.find((t) => t.id === templateId);
          if (!tmpl) return;
          Alert.alert(
            "Apply template?",
            `Replace this week's plan with "${tmpl.name}"?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Apply",
                onPress: () => {
                  const next = applyTemplateToWeek(tmpl);
                  setPlan(next as DayPlan[]);
                  track(AnalyticsEvents.plan_template_applied, {
                    dayCount: tmpl.dayCount,
                    slotCount: tmpl.slots.length,
                  });
                  setTemplatesOpen(false);
                },
              },
            ],
          );
        }}
        onDelete={async (templateId) => {
          if (!userId) return { ok: false, error: "Sign in required." };
          const { error } = await deletePlanTemplate(supabase, userId, templateId);
          if (error) return { ok: false, error };
          setPlanTemplates((prev) => prev.filter((t) => t.id !== templateId));
          return { ok: true };
        }}
      />
      <MoveMealSheet
        visible={moveSheetOpen}
        onClose={() => {
          setMoveSheetOpen(false);
          setMoveSource(null);
        }}
        plan={plan}
        from={moveSource}
        dayLabels={(plan ?? []).map((_, idx) => {
          const cal = planCalendarDateForIndex(idx, startOffset);
          return WEEKDAY_LONG[cal.getDay()] ?? `Day ${idx + 1}`;
        })}
        onMove={(to) => {
          if (!moveSource) return;
          handleMove(moveSource, to);
          setMoveSheetOpen(false);
          setMoveSource(null);
        }}
      />
    </View>
  );
}
