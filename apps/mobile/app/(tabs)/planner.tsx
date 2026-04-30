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
  Modal,
  FlatList,
  InteractionManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "@/context/auth";
import { useDiscoverRecipes, useSavedLibraryRecipes } from "@/lib/recipes";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { upsertShoppingListJsonItems } from "../../../../src/lib/supabase/shoppingJsonFallback";
import { fetchMealPlanJson, upsertMealPlanJson } from "../../../../src/lib/supabase/phase1LegacyJsonb";
import { dateKeyFromDate, newMealId } from "@/lib/nutritionJournal";
import { snapshotDailyTargetIfMissing } from "../../../../src/lib/nutrition/dailyTargetSnapshot";
import {
  Check,
  CheckCircle2,
  Circle,
  Coffee,
  Cookie,
  Plus,
  RefreshCw,
  Settings2,
  ShoppingCart,
  Sun,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets } from "@/lib/calcTargets";
import {
  generateSmartPlan,
  ALL_MEAL_SLOTS,
  DEFAULT_PLANNER_BANDS,
  PORTION_MULTIPLIER_CLAMP,
  type PlannerTargets,
} from "@/lib/mealPlanAlgo";
import { isMealPlanPlaceholderLikeTitle } from "../../../../src/lib/nutrition/portionMultiplier";
import { coerceMacrosWhenCaloriesButNoGrams } from "../../../../src/lib/nutrition/coerceRecipeMacrosForPlanning";
import {
  findPlanDayIdForCalendarDate,
  planCalendarDateForIndex,
  startDateForOffset,
  stripMidnight,
} from "../../../../src/lib/mealPlan/planCalendarAnchor";
import { formatPlannedMealKcalMacrosLine } from "../../../../src/lib/nutrition/plannedMealDisplay";
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
import { HouseholdSummaryRow } from "@/components/HouseholdSummaryRow";
import { MoveMealSheet } from "@/components/MoveMealSheet";
import { PlanTemplatesSheet } from "@/components/PlanTemplatesSheet";
import { useMealPlanSlots } from "@/hooks/use-meal-plan-slots";
import { PlanSubTabHeader } from "@/components/tabs/PlanSubTabHeader";

function stripPlanPlaceholders<T extends { recipeTitle: string; isPlaceholder?: boolean }>(meals: T[]): T[] {
  return meals.filter(
    (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
  );
}

/** Keep meal rows in Breakfast → Lunch → Dinner → Snacks order. */
function sortMealsBySlotOrder<T extends { name: string }>(meals: T[]): T[] {
  const order: Record<PlanSlotIconKey, number> = { breakfast: 0, lunch: 1, dinner: 2, snacks: 3 };
  const rank = (name: string) => order[resolvePlanSlotIconKey(name)] ?? 99;
  return [...meals].sort((a, b) => rank(a.name) - rank(b.name));
}

function slotsPresentInDay(meals: { name: string }[]): Set<string> {
  const s = new Set<string>();
  for (const m of meals) {
    const n = normaliseMealSlot(m.name);
    if (n) s.add(n);
  }
  return s;
}

/** Canonical slots (Breakfast…Snacks) with no row on this day — used for + Add back chips.
 *  Intentionally not gated on `enabledSlots`: that Set is only in-memory for regenerate
 *  and can be empty/out of sync after navigation, which would hide all add-back actions. */
function canonicalSlotsMissingFromDay(meals: { name: string }[]): string[] {
  const present = slotsPresentInDay(meals);
  return ALL_MEAL_SLOTS.filter((slot) => !present.has(slot));
}

/** True when this row has a chosen recipe (ignore stale `isPlaceholder` flags). */
function planMealHasRecipe(meal: { recipeTitle?: string }): boolean {
  return !!(meal.recipeTitle && String(meal.recipeTitle).trim());
}

/** All portion steps from the shared planner clamp (0.2× … 2.5×, 0.1 step). */
function plannerPortionMultiplierSteps(): number[] {
  const { min, max, step } = PORTION_MULTIPLIER_CLAMP;
  const inv = 1 / step;
  const out: number[] = [];
  for (let x = min; x <= max + 1e-9; x += step) {
    out.push(Math.round(x * inv) / inv);
  }
  return out;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

// Prototype port (2026-04-20) — slot icon key → lucide icon. Mirrored
// on web with lucide-react icons (see `MealPlanner.tsx` `SLOT_ICON_WEB`).
// Keys come from the shared `resolvePlanSlotIconKey` so legacy / voice
// slot values can never drift a row into a blank square.
// Keep in sync with `TodayMealsSection.tsx` `SLOT_ICON` — Plan and Today
// must show the same icon per slot (Grace 2026-04-20).
// Design-system sweep (2026-04-21, R5) — migrated Ionicons/MCI → lucide.
// Dinner uses `UtensilsCrossed` (not Moon) for semantic clarity.
const SLOT_ICON_MOBILE: Record<PlanSlotIconKey, LucideIcon> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: UtensilsCrossed,
  snacks: Cookie,
};

// Colour parity with `TodayMealsSection.tsx` `SLOT_COLOR`.
const SLOT_COLOR_MOBILE: Record<PlanSlotIconKey, string> = {
  breakfast: Accent.warning,
  lunch: Accent.success,
  dinner: Accent.primary,
  snacks: MacroColors.fat,
};

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

type PlanRecipeRef = { id: string; title: string; calories: number };

/**
 * 2026-04-26 polish (round 2): snap displayed portion multipliers to the
 * canonical {0.5, 1, 1.5, 2} set so legacy plans (generated before the
 * 2026-04-25 clamp tightening) don't render as "0.3×" or "1.8×". The
 * underlying multiplier on `meal.portionMultiplier` and `meal.calories`
 * is unchanged — only the *displayed* chip label is rounded, so day
 * totals stay accurate. New plans produced post-clamp are already snapped
 * by the algorithm, so this is a render-only safety net for prod data.
 */
function snapDisplayMultiplier(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  // Round to nearest 0.5, clamp to [0.5, 2].
  const stepped = Math.round(raw * 2) / 2;
  return Math.min(2, Math.max(0.5, stepped));
}

/** Portion vs library recipe card — used for "(2.5x)" label and `/recipe?id&portion=` when multiplier isn't stored. */
function planMealPortionMeta(meal: PlanMeal, pool: PlanRecipeRef[]): { displayMult: number; label: string } {
  const pm = meal.portionMultiplier;
  if (typeof pm === "number" && Number.isFinite(pm) && Math.abs(pm - 1) > 0.001) {
    const snapped = snapDisplayMultiplier(pm);
    const label = Number.isInteger(snapped) ? String(snapped) : String(snapped);
    return { displayMult: snapped, label };
  }
  const ref =
    (meal.recipeId ? pool.find((r) => r.id === meal.recipeId) : undefined) ??
    pool.find((r) => r.title.trim() === meal.recipeTitle.trim());
  const rc = ref && Number(ref.calories) > 0 ? Number(ref.calories) : 0;
  if (!rc || !Number.isFinite(meal.calories) || meal.calories <= 0) {
    return { displayMult: 1, label: "1" };
  }
  const ratio = meal.calories / rc;
  if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.02) {
    return { displayMult: 1, label: "1" };
  }
  const snapped = snapDisplayMultiplier(ratio);
  const label = Number.isInteger(snapped) ? String(snapped) : String(snapped);
  return { displayMult: snapped, label };
}

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();

  const { recipes: discoverRecipes } = useDiscoverRecipes();
  const { recipes: savedRecipes } = useSavedLibraryRecipes(userId);

  const planRecipePool = useMemo<PlanRecipeRef[]>(
    () =>
      [...savedRecipes, ...discoverRecipes].map((r) => ({
        id: r.id,
        title: r.title,
        calories: Number(r.calories) || 0,
      })),
    [savedRecipes, discoverRecipes],
  );

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

  // F-91 (2026-04-25, sync-enforcer P0-7) — hydrate from cached tier
  // synchronously on mount so Pro users don't see a "free" gate flash
  // while the async profile + RC reconcile resolves. Cache is rewritten
  // at every successful resolve below.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { loadCachedUserTier } = await import("@/lib/cachedUserTier");
      const cached = await loadCachedUserTier();
      if (!cancelled) setUserTier(cached);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load user tier from profile. F-43 (2026-04-22, TestFlight "Pro
  // user shown as Free on Plan" x2): reconcile profile with
  // RevenueCat entitlements + promo redemptions before reading, so a
  // stale `profiles.user_tier` doesn't downgrade a user who is
  // entitled via RC or promo but whose profile wasn't synced since
  // the last paywall / promo redeem.
  //
  // F-58 (2026-04-22, TestFlight build-28 "On pro but plans thinks
  // I'm on free" x3): two holes in F-43 —
  //  (a) `getCustomerInfo` was called without first ensuring RC was
  //      logged in as the Supabase userId. If the user signed in
  //      after app boot, RC stayed anonymous → no entitlements → the
  //      merge-max wrote "free" into `profiles.user_tier`, clobbering
  //      a legitimately Pro profile.
  //  (b) the `catch {}` was silent, so any RC misconfig (TestFlight
  //      without RC API key, network hiccup) hid behind a stale
  //      profile read.
  // Fix: `ensurePurchasesUser(userId)` before `getCustomerInfo`, and
  // log the failure mode in dev.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const purchases = await import("@/lib/purchases");
        await purchases.ensurePurchasesUser(userId);
        const info = await purchases.getCustomerInfo();
        await purchases.syncTierToSupabase(info, supabase as any, userId);
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[planner] RC reconcile failed — falling back to profile read", err);
        }
      }
      if (cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("user_tier")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const tier = (data?.user_tier as string | null) ?? null;
      const resolved: "free" | "base" | "pro" =
        tier === "free" || tier === "base" || tier === "pro" ? tier : "free";
      setUserTier(resolved);
      // F-91 — persist for next mount so the gate doesn't flash Free
      // again on the next Plan-tab open.
      void import("@/lib/cachedUserTier").then(({ saveCachedUserTier }) =>
        saveCachedUserTier(resolved),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isFree = userTier === "free";
  const [planTargets, setPlanTargets] = useState<{ calories: number; protein: number; carbs: number; fat: number; fiber?: number } | null>(null);
  const [enabledSlots, setEnabledSlots] = useState<Set<string>>(new Set(ALL_MEAL_SLOTS));
  const [shoppingItemCount, setShoppingItemCount] = useState(0);

  // Batch 3.10 — plan templates state.
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  /** When a plan exists: expand to change day count / slots / start before regenerating. */
  const [planSetupExpanded, setPlanSetupExpanded] = useState(false);
  const [portionModal, setPortionModal] = useState<{ dayIdx: number; mealIndex: number } | null>(null);

  // Batch 3.10 (mobile parity, 2026-04-18 audit C2) — Move meal state.
  // Long-press a meal row → action sheet → "Move to another slot…" opens
  // `MoveMealSheet` with `moveSource` set to the pressed cell.
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [moveSource, setMoveSource] = useState<{ day: number; slotIndex: number } | null>(null);

  // P2-40 (TestFlight `APU2FBCjLALmugeCLmQ4Ii0`, 2026-04-25):
  // generic "Could not load templates" toast was a dead end —
  // no retry, no explanation. Add a retry counter so the alert
  // gives the user a button to try again, plus a friendlier
  // explanation when the error is offline-shaped.
  const [templatesLoadAttempt, setTemplatesLoadAttempt] = useState(0);
  useEffect(() => {
    if (!templatesOpen || !userId) return;
    let cancelled = false;
    setTemplatesLoading(true);
    listPlanTemplates(supabase, userId)
      .then(({ templates, error }) => {
        if (cancelled) return;
        if (error) {
          const friendly =
            String(error).match(/network|fetch|offline/i)
              ? "Couldn't reach Suppr. Check your connection and try again."
              : `Could not load templates: ${error}`;
          Alert.alert(
            "Templates",
            friendly,
            [
              { text: "Cancel", style: "cancel", onPress: () => setTemplatesOpen(false) },
              { text: "Try again", onPress: () => setTemplatesLoadAttempt((n) => n + 1) },
            ],
          );
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
  }, [templatesOpen, userId, templatesLoadAttempt]);

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

  /**
   * Persist a plan back to Supabase — relational tables first with legacy
   * JSONB fallback. Mirrors the tail of `generatePlan`. Declared before
   * `swapMeal` so recipe swaps can persist immediately.
   */
  const persistPlan = useCallback(
    async (nextPlan: DayPlan[]) => {
      if (!userId) return;
      // T15 (2026-04-24): single atomic RPC replaces the legacy
      // delete + 7-day-insert + 7-meals-insert chain (15 RTTs, no
      // transaction). save_meal_plan does the whole replace inside
      // one Postgres statement transaction — backgrounding the app
      // mid-save can no longer leave a partial plan.
      // T7: startOffset (UI chip 0/1/7) → start_date YYYY-MM-DD.
      const startDate = startDateForOffset(new Date(), startOffset);
      const planPayload = nextPlan.map((dp) => ({
        day: dp.day,
        meals: dp.meals.map((m, idx) => ({
          slot_index: idx,
          name: m.name,
          recipe_title: m.recipeTitle,
          recipe_id: m.recipeId ?? null,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          portion_multiplier: m.portionMultiplier ?? 1,
          is_placeholder: m.isPlaceholder ?? false,
        })),
      }));
      const { error } = await supabase.rpc("save_meal_plan", {
        p_slot_id: "default",
        p_start_date: startDate,
        p_plan: planPayload,
      } as never);
      if (error) {
        // Legacy fallback for environments missing the migration
        // (function-not-found 42883). After the rollout window this
        // branch can be removed.
        if ((error as { code?: string }).code === "42883") {
          void upsertMealPlanJson(supabase, userId, nextPlan);
        } else if (__DEV__) {
          console.warn("[persistPlan] save_meal_plan failed:", error.message);
        }
      }
    },
    [userId, startOffset],
  );

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

    // P1-22 (TestFlight `APHEBaM02gFAhoeHQ5mtxuE`,
    // `AFF_UA88-CeE5TDCRhbaY_M`, 2026-04-24): tester couldn't find a
    // way to add a library recipe to a specific slot. The picker
    // already pulls saved recipes first — surface that with a label
    // tag and a clearer title so the action reads as "pick from your
    // library" rather than just "swap".
    const savedSet = new Set(savedRecipes.map((r) => r.id));
    const options = sorted.slice(0, 10).map(
      (r) => `${savedSet.has(r.id) ? "★ " : ""}${r.title} (${r.calories} kcal)`,
    );
    options.push("Cancel");

    const savedCount = sorted.slice(0, 10).filter((r) => savedSet.has(r.id)).length;
    const subtitle =
      savedCount > 0
        ? `★ from your library · Target ~${Math.round(slotTarget)} kcal`
        : `Target: ~${Math.round(slotTarget)} kcal for this slot`;

    Alert.alert(
      `Pick recipe for ${slotName}`,
      subtitle,
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
              const next = prev.map((dp, di) => {
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
                    isPlaceholder: false,
                    leftoverOf: undefined,
                    isLeftover: undefined,
                    portionMultiplier: undefined,
                    // Portion is baked into macros — never persist a parallel
                    // multiplier or day totals / goal header double-count (F-70).
                  };
                });
                const totals = newMeals.reduce(
                  (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
                  { calories: 0, protein: 0, carbs: 0, fat: 0 },
                );
                return { ...dp, meals: newMeals, totals };
              });
              void persistPlan(next);
              return next;
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
  }, [savedRecipes, discoverRecipes, plan, planTargets, persistPlan]);

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

  const portionMultiplierList = useMemo(() => plannerPortionMultiplierSteps(), []);

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
        // Audit 2026-04-29 papercut #11 — bold 700-weight saturated
        // Accent.primary text screamed for attention with 2-4 of these
        // visible per day card, competing with the rest of the page.
        // Demote to a subtle-fill pill (8% Accent bg, primary text,
        // 600-weight) so the button reads as a tappable affordance
        // without dominating. Mirrors the #3 demotion of the Today
        // suggestion-card CTA.
        mealLogBtn: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          minWidth: 64,
          borderRadius: 8,
          backgroundColor: `${Accent.primary}14`,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 4,
        },
        mealLogBtnText: { fontSize: 12, fontWeight: "600", color: Accent.primary, textAlign: "center" },
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
      // Try relational tables. T7 (2026-04-24): SELECT start_date so
      // consumers that resolve "today's plan day" read the persisted
      // calendar anchor instead of iterating offsets. Column added in
      // migration 20260503100300_meal_plan_days_start_date.sql.
      const { data: dayRows, error: dayErr } = await supabase
        .from("meal_plan_days")
        .select("id, day, start_date")
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
              (mealsByDay.get(d.id) ?? []).map((m) => {
                const coerced = coerceMacrosWhenCaloriesButNoGrams({
                  calories: (m.calories as number) ?? 0,
                  protein: (m.protein as number) ?? 0,
                  carbs: (m.carbs as number) ?? 0,
                  fat: (m.fat as number) ?? 0,
                });
                return {
                  name: (m.name as string) ?? "",
                  recipeTitle: (m.recipe_title as string) ?? "",
                  calories: coerced.calories,
                  protein: coerced.protein,
                  carbs: coerced.carbs,
                  fat: coerced.fat,
                  // Relational rows historically stored `portion_multiplier` alongside
                  // already-scaled kcal from swap/adjust — strip so totals match rows.
                  portionMultiplier: undefined,
                  isPlaceholder: (m.is_placeholder as boolean) || undefined,
                };
              }),
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

  // Keep "Plan length" chips aligned with the loaded plan (e.g. after sync).
  useEffect(() => {
    if (!plan?.length) return;
    if (plan.length === 1 || plan.length === 3 || plan.length === 7) {
      setDays(plan.length as 1 | 3 | 7);
    }
  }, [plan?.length]);

  /**
   * F1 fix (audit 2026-04-28) — generate shopping_items rows from a
   * given plan. Lifted out of the dead-code block below the action
   * row so it can be called from (a) `generatePlan` after a fresh
   * plan is set, and (b) the summary-card "Shopping list" button when
   * the count is 0 (so a user who lands on an empty list with an
   * active plan can rebuild without leaving the screen).
   *
   * Side-effects: deletes existing `shopping_items` for the user,
   * then inserts in batches of 50. Returns `{ ok, count }` so the
   * caller can decide whether to surface a toast.
   */
  const generateShoppingListFromPlan = useCallback(
    async (
      planForGeneration: DayPlan[],
    ): Promise<{ ok: true; count: number } | { ok: false; error: string }> => {
      if (!userId) return { ok: false, error: "Not signed in" };
      const allRecipes = [...savedRecipes, ...discoverRecipes];
      const recipeIds: string[] = [];
      for (const dp of planForGeneration) {
        for (const m of dp.meals) {
          const rid = m.recipeId ?? allRecipes.find((r) => r.title === m.recipeTitle)?.id;
          if (rid && !recipeIds.includes(rid)) recipeIds.push(rid);
        }
      }
      if (recipeIds.length === 0) return { ok: false, error: "No recipe ids in plan" };

      const { data: ingredients, error: ingErr } = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, recipe_id")
        .in("recipe_id", recipeIds);
      if (ingErr) return { ok: false, error: ingErr.message };
      if (!ingredients || ingredients.length === 0) {
        return { ok: false, error: "No ingredient data on these recipes" };
      }

      // Count recipe occurrences (skip leftover rows so a single batch
      // cook isn't triple-bought).
      const recipeCounts: Record<string, number> = {};
      const recipeTitles: Record<string, string> = {};
      for (const dp of planForGeneration) {
        for (const m of dp.meals) {
          if ((m as PlanMeal).leftoverOf) continue;
          const rid = m.recipeId ?? allRecipes.find((r) => r.title === m.recipeTitle)?.id;
          if (rid) {
            recipeCounts[rid] = (recipeCounts[rid] ?? 0) + 1;
            recipeTitles[rid] = m.recipeTitle;
          }
        }
      }

      const merged = new Map<
        string,
        { name: string; amount: number; unit: string; from: Set<string> }
      >();
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

      const inserts = items.map((item) => ({
        user_id: userId,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        category: item.category,
        checked: item.checked,
        source: item.source,
      }));

      const { error: delErr } = await supabase.from("shopping_items").delete().eq("user_id", userId);
      if (delErr) {
        const { error: upErr } = await upsertShoppingListJsonItems(supabase, userId, items);
        if (upErr) return { ok: false, error: upErr.message };
      } else if (inserts.length > 0) {
        for (let i = 0; i < inserts.length; i += 50) {
          const batch = inserts.slice(i, i + 50);
          const { error: insErr } = await supabase.from("shopping_items").insert(batch);
          if (insErr) return { ok: false, error: insErr.message };
        }
      }

      setShoppingItemCount(inserts.length);
      return { ok: true, count: inserts.length };
    },
    [userId, savedRecipes, discoverRecipes],
  );

  const generatePlan = useCallback(async () => {
    if (savedRecipes.length === 0 && discoverRecipes.length === 0) {
      Alert.alert("No recipes available", "Save at least 1 recipe from Discover to generate a plan.");
      return;
    }

    setGenerating(true);

    // P1-24 (TestFlight `AMXSjeaXJeCf6QtKgUTMkD0`,
    // `ALU8hrB1I9Sn4ysqoR_ocEs`, 2026-04-22+): when the user starts
    // a fresh plan, the previous plan's shopping_items rows were
    // still in the DB so the "37 items from this week" subtitle
    // would persist alongside the "Generate Shopping List" button —
    // two UIs disagreeing about whether the list existed. Wipe the
    // shopping items at the start of every plan generation so the
    // count truthfully resets to 0 until the user re-generates the
    // list against the new plan. Web parity: `AppDataContext.tsx`'s
    // shopping-clear effect already handles plan-cleared
    // transitions; this covers the plan-replaced case.
    if (userId) {
      try {
        await supabase.from("shopping_items").delete().eq("user_id", userId);
      } catch {
        /* best-effort — generation should still proceed */
      }
      setShoppingItemCount(0);
    }

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
        // P1-9 (2026-04-25): import shared defaults so web + mobile
        // can't drift on macro tolerance bands.
        calorieBandPct: DEFAULT_PLANNER_BANDS.calorieBandPct,
        carbFatBandPct: DEFAULT_PLANNER_BANDS.carbFatBandPct,
      };
      if (__DEV__) console.log("[planner] targets:", targets);

      // Use saved recipes first, then fill with discover recipes if the user doesn't
      // have enough variety to populate all meal slots.
      const savedPool = savedRecipes.map((r) => {
        const c = coerceMacrosWhenCaloriesButNoGrams({
          calories: r.calories,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
          fiberG: (r as { fiberG?: number }).fiberG,
        });
        return {
          id: r.id,
          title: r.title,
          calories: c.calories,
          protein: c.protein,
          carbs: c.carbs,
          fat: c.fat,
          fiberG: c.fiberG ?? (r as { fiber_g?: number }).fiber_g ?? (r as { fiberG?: number }).fiberG ?? 0,
          mealType: r.mealSlots ?? null,
        };
      });
      const discoverPool = discoverRecipes
        .filter((r) => !savedRecipes.some((s) => s.id === r.id))
        .map((r) => {
          const c = coerceMacrosWhenCaloriesButNoGrams({
            calories: r.calories,
            protein: r.protein,
            carbs: r.carbs,
            fat: r.fat,
            fiberG: r.fiberG,
          });
          return {
            id: r.id,
            title: r.title,
            calories: c.calories,
            protein: c.protein,
            carbs: c.carbs,
            fat: c.fat,
            mealType: (r as { mealSlots?: string[] | null }).mealSlots ?? null,
          };
        });
      const fullPool = [...savedPool, ...discoverPool];
      const recipePool = savedPool.length >= 6 ? savedPool : fullPool;

      // T14 (full-sweep 2026-04-24): `generateSmartPlan` is a sync
      // sampler over ~20k combinations — 6-11s on-device at pool ≥30.
      // Yield to the UI thread via InteractionManager before running
      // so the regenerate spinner actually paints, and instrument
      // duration so we can tune the sampler cap with real data.
      const slotCount = ALL_MEAL_SLOTS.filter((s) => enabledSlots.has(s)).length;
      const generateStartMs = Date.now();
      const rawPlan = await new Promise<ReturnType<typeof generateSmartPlan>>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          resolve(
            generateSmartPlan({
              recipes: recipePool,
              targets,
              days,
              slotConfig: { slots: ALL_MEAL_SLOTS.filter((s) => enabledSlots.has(s)) },
            }),
          );
        });
      });
      const generateDurationMs = Date.now() - generateStartMs;
      track(AnalyticsEvents.meal_plan_generated, {
        days,
        durationMs: generateDurationMs,
        poolSize: recipePool.length,
        slotCount,
        platform: "mobile",
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

      // F1 fix (audit 2026-04-28): regenerate must REBUILD the
      // shopping list, not just purge it. Previously the regenerate
      // path purged `shopping_items` rows but the UI's only path to
      // rebuild was a dead-code "Generate Shopping List" button —
      // user landed on Shopping with an empty list and "Generate a
      // meal plan first" copy even with an active plan. Now the
      // shopping list auto-rebuilds against the new plan; if the
      // rebuild itself errors (no ingredient data on the recipes,
      // network drop), we still set count=0 so the user knows the
      // list was reset.
      if (userId) {
        void generateShoppingListFromPlan(newPlan).then((res) => {
          if (!res.ok) setShoppingItemCount(0);
        });
      }

      // Persist via T15 atomic RPC (one round-trip, transactional).
      if (userId) {
        (async () => {
          const startDate = startDateForOffset(new Date(), startOffset);
          const planPayload = newPlan.map((dp) => ({
            day: dp.day,
            meals: dp.meals.map((m, idx) => ({
              slot_index: idx,
              name: m.name,
              recipe_title: m.recipeTitle,
              recipe_id: m.recipeId ?? null,
              calories: m.calories,
              protein: m.protein,
              carbs: m.carbs,
              fat: m.fat,
              portion_multiplier: m.portionMultiplier ?? 1,
              is_placeholder: m.isPlaceholder ?? false,
            })),
          }));
          const { error } = await supabase.rpc("save_meal_plan", {
            p_slot_id: "default",
            p_start_date: startDate,
            p_plan: planPayload,
          } as never);
          if (error) {
            if ((error as { code?: string }).code === "42883") {
              void upsertMealPlanJson(supabase, userId, newPlan);
            } else if (__DEV__) {
              console.warn("[persistPlan/regenerate] save_meal_plan failed:", error.message);
            }
          }
        })();
      }
    }
  }, [savedRecipes, days, userId, enabledSlots]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Phase 2 / B1.1 — Plan sub-tab pill bar (Plan default,
          Shopping list as a sub-view). Tapping "Shopping" routes to
          the existing `/shopping` screen which carries a mirroring
          header so the user can return without losing their place. */}
      <PlanSubTabHeader
        value="plan"
        onChange={(next) => {
          if (next === "shopping") {
            router.push("/shopping" as Href);
          }
        }}
      />
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
          {/* F-29 (2026-04-21): Regenerate was previously only reachable
              via the "This week" summary card, which hides when
              summaryScore is null (e.g. empty-day view, no planTargets).
              TestFlight AAtQgwFWaQTF — "regenerate section is missing".
              Surface the action at the header level whenever a plan
              exists so it's always one tap away. */}
          {plan && plan.length > 0 ? (
            <Pressable
              style={[styles.headerIconBtn, { marginRight: 8 }]}
              onPress={generatePlan}
              disabled={generating}
              accessibilityRole="button"
              accessibilityLabel="Regenerate plan"
            >
              {generating ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <RefreshCw size={16} color={colors.text} strokeWidth={1.75} />
              )}
            </Pressable>
          ) : null}
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => setTemplatesOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Plan options"
          >
            <Settings2 size={18} color={colors.text} strokeWidth={1.75} />
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
                  <Check size={11} color={Accent.primary} strokeWidth={1.75} />
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
            <Plus size={12} color={colors.textSecondary} strokeWidth={1.75} />
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
                onPress={async () => {
                  // F1 fix (2026-04-28): if the shopping list is
                  // empty (e.g. plan was regenerated and the auto-
                  // rebuild failed, or the user is hitting this for
                  // the first time after migration), build it from
                  // the active plan before navigating. Falling
                  // through silently to /shopping landed users on a
                  // "Generate a meal plan first" empty state even
                  // when they had an active plan.
                  if (plan && shoppingItemCount === 0) {
                    const res = await generateShoppingListFromPlan(plan);
                    if (!res.ok) {
                      Alert.alert(
                        "Couldn't build shopping list",
                        `${res.error}\n\nOpening Shopping anyway — you can retry from there.`,
                      );
                    }
                  }
                  router.push("/shopping");
                }}
                accessibilityRole="button"
                accessibilityLabel="Open shopping list"
              >
                <ShoppingCart size={14} color="#fff" strokeWidth={1.75} />
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
                    <RefreshCw size={14} color={colors.text} strokeWidth={1.75} />
                    <Text style={styles.summarySecondaryText}>Regenerate</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* P1-12 / P1-13 (TestFlight `ALQQyjCHjzbtxaCSPW18glk` +5,
            2026-04-22): the full HouseholdCard with sharing grid + invite
            UI was eating the Plan tab's above-the-fold and confused
            testers about which screen owned what. Replaced with a 1-line
            summary row that opens the dedicated household-settings
            screen; tester ask was explicit ("this page should just be
            showing the household, like the prototype"). */}
        <HouseholdSummaryRow />

        {/* Plan setup — visible whenever a plan exists so users can change
            day count, start date, and included slots before regenerating
            without clearing the whole plan first.
            2026-04-30 audit visual-qa P1 #6: when collapsed, was a
            full-width card with body copy ("Tap to change how many
            days...") that competed with the actual meal rows. Now
            renders as a quiet single-line header in collapsed state —
            settings UI shouldn't dominate the surface that's supposed
            to show this week's plan. Expanded state still shows the
            full options below. */}
        {plan && plan.length > 0 ? (
          <View style={[styles.card, !planSetupExpanded && { paddingVertical: Spacing.md }]}>
            <Pressable
              onPress={() => setPlanSetupExpanded((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              accessibilityRole="button"
              accessibilityLabel={planSetupExpanded ? "Collapse plan setup" : "Expand plan setup"}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.cardTitle}>Plan setup</Text>
                {planSetupExpanded ? (
                  <Text style={styles.cardDesc}>
                    Change options below, then regenerate. Edits to individual meals (swap, portion, clear) apply immediately.
                  </Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 18, color: colors.textSecondary }}>{planSetupExpanded ? "▼" : "▶"}</Text>
            </Pressable>
            {planSetupExpanded ? (
              <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
                <Text style={styles.sectionLabel}>Plan length</Text>
                <View style={styles.daysRow}>
                  {([1, 3, 7] as const).map((d) => {
                    const locked = isFree && d > 1;
                    return (
                      <Pressable
                        key={d}
                        style={[styles.dayBtn, days === d && styles.dayBtnActive, locked && { opacity: 0.5 }]}
                        onPress={() => {
                          if (locked) {
                            Alert.alert("Upgrade required", "Plan your full week and generate a ready-to-shop list. Available with Pro.", [
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
                      <Text style={[styles.dayBtnText, startOffset === o.val && styles.dayBtnTextActive]}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.sectionLabel}>Include when regenerating</Text>
                <View style={[styles.daysRow, { flexWrap: "wrap" }]}>
                  {ALL_MEAL_SLOTS.map((slot) => {
                    const active = enabledSlots.has(slot);
                    return (
                      <Pressable
                        key={slot}
                        style={[styles.dayBtn, active && styles.dayBtnActive]}
                        onPress={() => toggleSlot(slot)}
                      >
                        {active ? (
                          <CheckCircle2 size={14} color="#fff" strokeWidth={1.75} style={{ marginRight: 4 }} />
                        ) : (
                          <Circle size={14} color={colors.textSecondary} strokeWidth={1.75} style={{ marginRight: 4 }} />
                        )}
                        <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>{slot}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 17 }}>
                  To drop a slot on one day, long-press that row →{" "}
                  <Text style={{ fontWeight: "700" }}>Remove slot (this day)</Text>. Use{" "}
                  <Text style={{ fontWeight: "700" }}>+ Add …</Text> under the day to bring a slot back.
                </Text>
                <Pressable
                  style={[styles.generateBtn, { marginTop: Spacing.sm }, generating && { opacity: 0.7 }]}
                  onPress={generatePlan}
                  disabled={generating}
                  accessibilityRole="button"
                  accessibilityLabel="Regenerate plan with current setup"
                >
                  {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Regenerate with these settings</Text>}
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

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
            <Pressable
              onPress={() => router.push("/(tabs)/library" as Href)}
              accessibilityRole="button"
              accessibilityLabel="Open recipe library"
              style={{ alignSelf: "flex-start", marginTop: Spacing.sm, marginBottom: Spacing.xs }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: Accent.primary }}>
                Open recipe library
              </Text>
            </Pressable>

            <View style={styles.daysRow}>
              {([1, 3, 7] as const).map((d) => {
                const locked = isFree && d > 1;
                return (
                  <Pressable
                    key={d}
                    style={[styles.dayBtn, days === d && styles.dayBtnActive, locked && { opacity: 0.5 }]}
                    onPress={() => {
                      if (locked) {
                        Alert.alert("Upgrade required", "Plan your full week and generate a ready-to-shop list. Available with Pro.", [
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
                    {active ? (
                      <CheckCircle2
                        size={14}
                        color="#fff"
                        strokeWidth={1.75}
                        style={{ marginRight: 4 }}
                      />
                    ) : (
                      <Circle
                        size={14}
                        color={colors.textSecondary}
                        strokeWidth={1.75}
                        style={{ marginRight: 4 }}
                      />
                    )}
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
          <View style={{ marginBottom: Spacing.sm }}>
            <Text style={styles.sectionLabel}>
              {plan.length === 1
                ? `${WEEKDAY_LONG[planCalendarDateForIndex(0, startOffset).getDay()]}'s plan`
                : `Your ${plan.length}-day plan`}
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/library" as Href)}
              accessibilityRole="button"
              accessibilityLabel="Browse recipe library"
              style={{ marginTop: 4 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: Accent.primary }}>Browse recipe library</Text>
            </Pressable>
          </View>
        )}

        {/* Plan display */}
        {plan && plan.map((dp, dayIdx) => {
          // Build-12 H-5 (TestFlight `AH8csBqtZsBJJr0uHgXyEcE`,
          // 2026-04-19): "Plan doesn't tell me how close it is to my
          // macro targets." The shared helper builds an explicit
          // "Day total · X / Y kcal · P / C / F" line with symmetric
          // ±10% / ±20% tolerance bands. Totals respect per-meal
          // `buildDayTotalVsGoalLine` → `dayPlanTotalsFromMeals` sums each
          // meal row's display macros (portion already baked). When the
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
          // P1-10 / Carryover rule #1 (2026-04-25): over-budget reads
          // amber, not red. Red is reserved for hard errors. Plan day
          // total can be over-budget ("ok-ish, you've gone over") which
          // should look distinct from "broken" — amber matches the
          // prototype carryover and the Today over-budget treatment.
          const toneColor = (tone: DayTotalTone): string =>
            tone === "neutral"
              ? colors.textSecondary
              : Accent.warning;
          // Prototype port (2026-04-20) — day total surfaces as
          // "1,820 kcal" (thousands-separator, right-aligned) in the
          // day header. Sum from non-placeholder meals so cleared
          // slots don't drag the number to 0 when other meals are
          // present; also omits leftover-companion rows implicitly
          // because those still carry macros and belong in the total.
          const dayTotalKcal = dp.meals
            .filter((m) => planMealHasRecipe(m))
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
              {/* F-63a (2026-04-22): promote goal-aware kcal into the
                  header (`4,083 / 1,667 kcal`) and drop the separate
                  "Day total · P/C/F" wrap row below. Tester
                  AERuv07KI + AJ8Fk6ud flagged the Plan day card as
                  overcrowded and the macro section confusing —
                  reason: two rows (`Day total · P/C/F`) + delta pills
                  (`P 154g +42 …`) + the protein-gap hint carried
                  overlapping info. Macro state now flows through the
                  delta-pill row only, which already colour-codes
                  direction vs target. */}
              {goalLine && goalLine.hasTargets && goalLine.cells[0] ? (
                <Text
                  style={[
                    styles.dayTotals,
                    { color: toneColor(goalLine.cells[0].tone), fontVariant: ["tabular-nums"] },
                  ]}
                  accessibilityLabel={`${Math.round(goalLine.totals.calories)} of ${planTargets!.calories} kcal for the day`}
                  testID={`day-total-vs-goal-${dp.day}`}
                >
                  {`${Math.round(goalLine.totals.calories).toLocaleString("en-US")} / ${planTargets!.calories.toLocaleString("en-US")} kcal`}
                </Text>
              ) : (
                <Text style={styles.dayTotals}>{Math.round(dayTotalKcal).toLocaleString("en-US")} kcal</Text>
              )}
            </View>
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
              const scorable = dp.meals.filter((m) => planMealHasRecipe(m));
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
              <Text style={{ fontSize: 14, color: colors.textSecondary, paddingVertical: Spacing.sm }}>
                No slots on this day yet. Add one below, or regenerate the plan.
              </Text>
            ) : null}
            {sortMealsBySlotOrder(dp.meals).map((meal) => {
              const mealIndexInDay = dp.meals.indexOf(meal);
              const multMeta = planMealPortionMeta(meal, planRecipePool);
              const currentMult = multMeta.displayMult;
              const multLabel = multMeta.label;
              return (
              <Pressable
                key={`${dp.day}-${mealIndexInDay}-${meal.name}`}
                style={styles.mealRow}
                delayLongPress={400}
                onLongPress={() => {
                  // Batch 3.10 mobile parity (2026-04-18 audit C2).
                  // Long-press → action sheet with Move / Swap / Delete / Cancel.
                  // Factual copy, no shame.
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const hasRecipe = planMealHasRecipe(meal);
                  const isEmptyRow = !hasRecipe;
                  const sourceDay = plan?.[dayIdx]?.day;
                  if (sourceDay == null || mealIndexInDay < 0) return;
                  Alert.alert(
                    hasRecipe ? meal.recipeTitle! : "Empty slot",
                    isEmptyRow
                      ? "No meal in this slot."
                      : `${Math.round(meal.calories)} kcal · ${meal.name}`,
                    [
                      {
                        text: "Move to another slot…",
                        onPress: () => {
                          if (isEmptyRow) {
                            Alert.alert("Nothing to move", "This slot is empty.");
                            return;
                          }
                          // If this meal is a parent of downstream leftovers,
                          // factually confirm the N we'll clear before the move.
                          const rid = meal.recipeId;
                          const leftoverCount =
                            rid && plan ? countLeftoversOfRecipe(plan, rid) : 0;
                          const openSheet = () => {
                            setMoveSource({ day: sourceDay, slotIndex: mealIndexInDay });
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
                          swapMeal(dayIdx, mealIndexInDay, meal.name);
                        },
                      },
                      ...(hasRecipe
                        ? [
                            {
                              text: "Adjust portion…",
                              onPress: () => setPortionModal({ dayIdx, mealIndex: mealIndexInDay }),
                            },
                          ]
                        : []),
                      {
                        text: "Remove slot (this day)",
                        style: "destructive" as const,
                        onPress: () => {
                          setPlan((prev) => {
                            if (!prev) return prev;
                            const next = prev.map((dpRow, di) => {
                              if (di !== dayIdx) return dpRow;
                              const newMeals = sortMealsBySlotOrder(
                                dpRow.meals.filter((_, mi) => mi !== mealIndexInDay),
                              );
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
                      { text: "Cancel", style: "cancel" },
                    ],
                  );
                }}
                onPress={() => {
                  const hasRecipeTap = planMealHasRecipe(meal);
                  Alert.alert(
                    hasRecipeTap ? meal.recipeTitle! : meal.name,
                    hasRecipeTap
                      ? `${Math.round(meal.calories)} kcal · ${multLabel}x portion`
                      : "Tap Swap to choose a recipe for this slot.",
                    [
                      {
                        text: "Swap meal",
                        onPress: () => swapMeal(dayIdx, mealIndexInDay, meal.name),
                      },
                      ...(hasRecipeTap
                        ? [
                            {
                              text: "Adjust portion…",
                              onPress: () => setPortionModal({ dayIdx, mealIndex: mealIndexInDay }),
                            },
                            {
                              text: "View recipe",
                              onPress: () => {
                                const id =
                                  meal.recipeId ??
                                  savedRecipes.find((x) => x.title === meal.recipeTitle)?.id ??
                                  discoverRecipes.find((x) => x.title === meal.recipeTitle)?.id;
                                if (id) router.push(`/recipe/${id}?portion=${currentMult}`);
                              },
                            },
                          ]
                        : []),
                      { text: "Cancel", style: "cancel" },
                    ],
                  );
                }}
              >
                {/* Prototype port (2026-04-20) — 36×36 slot icon-box on
                    the left. Key resolves via shared `resolvePlanSlotIconKey`
                    so legacy / voice-parsed slot text still lands on a
                    sensible icon. Both platforms now map the key to
                    lucide icons (see `SLOT_ICON_MOBILE` +
                    `SLOT_ICON_WEB` — the single source of truth is the
                    shared key). */}
                {(() => {
                  const slotKey = resolvePlanSlotIconKey(meal.name);
                  const Icon = SLOT_ICON_MOBILE[slotKey];
                  const tint = SLOT_COLOR_MOBILE[slotKey];
                  return (
                    <View style={[styles.mealIconBox, { backgroundColor: tint + "22" }]}>
                      <Icon size={16} color={tint} strokeWidth={1.75} />
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
                  {/* P1-11 (TestFlight `AERuv07KI` 2026-04-22): the
                      portion multiplier was concatenated onto the title
                      ("Best Green Shakshuka Recipe (2.5x)"), wrapping
                      to two or three lines when paired with the
                      one-line macro string. Render the multiplier as a
                      separate trailing badge and clamp the title to a
                      single line. */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.mealTitle, { flexShrink: 1 }]} numberOfLines={1}>
                      {planMealHasRecipe(meal) ? meal.recipeTitle : "Empty slot"}
                    </Text>
                    {planMealHasRecipe(meal) && multLabel !== "1" ? (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 4,
                          backgroundColor: Accent.primary + "1A",
                          flexShrink: 0,
                        }}
                        accessibilityLabel={`Portion ${multLabel} times`}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: Accent.primary,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {`${multLabel}×`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.mealMacros} numberOfLines={1}>
                    {planMealHasRecipe(meal)
                      ? formatPlannedMealKcalMacrosLine(
                          meal.calories,
                          meal.protein,
                          meal.carbs,
                          meal.fat,
                        )
                      : "— kcal · P —g · C —g · F —g"}
                  </Text>
                  {planMealHasRecipe(meal) &&
                  (meal as { macrosAreEstimated?: boolean }).macrosAreEstimated ? (
                    // P1-19 (2026-04-25): the recipe's calories don't agree
                    // with its gram macros; the planner is showing a neutral
                    // 28/42/30 split, not real data. Chip routes the user
                    // to verify. Journal-write paths refuse this row
                    // (P0-3 nutrition_entries guard); chip is the visual
                    // counterpart.
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        alignSelf: "flex-start",
                        marginTop: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: Accent.warning + "1F",
                      }}
                      accessibilityLabel="Estimated macros — open the recipe to verify"
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "600",
                          color: Accent.warning,
                        }}
                      >
                        Estimated · verify
                      </Text>
                    </View>
                  ) : null}
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
                    swapMeal(dayIdx, mealIndexInDay, meal.name);
                  }}
                  style={styles.mealSwapBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Pick a recipe for ${meal.name} from your library or Discover`}
                >
                  <RefreshCw size={13} color={colors.textSecondary} strokeWidth={1.75} />
                </Pressable>
                {/* Log to tracker — Suppr-specific action kept next to
                    the swap button (the prototype omits Log). */}
                <Pressable
                  hitSlop={8}
                  onPress={async (e) => {
                    e.stopPropagation?.();
                    const dk = dateKeyFromDate(new Date());
                    const entryId = newMealId();
                    // F30 fix (audit 2026-04-28): `meal.calories` etc.
                    // are already post-portion (the planner bakes
                    // portion into macros — see the per-meal storage
                    // contract). Persisting BOTH the post-portion
                    // macros AND `portion_multiplier: currentMult`
                    // would double-apply if any reader (tracker
                    // backfill, recap, weekly digest) multiplied
                    // again. Persist `portion_multiplier: 1` since
                    // the macros already reflect the user's choice.
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
                        portion_multiplier: 1,
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
            );
            })}
            {(() => {
              const missing = canonicalSlotsMissingFromDay(dp.meals);
              if (missing.length === 0) return null;
              return (
                <View
                  style={{
                    marginTop: Spacing.sm,
                    paddingTop: Spacing.sm,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: Spacing.sm }}>
                    Add a meal slot
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {missing.map((slot) => (
                      <Pressable
                        key={slot}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPlan((prev) => {
                            if (!prev) return prev;
                            const next = prev.map((dpRow, di) => {
                              if (di !== dayIdx) return dpRow;
                              if (slotsPresentInDay(dpRow.meals).has(slot)) return dpRow;
                              const newMeal: PlanMeal = {
                                name: slot,
                                recipeTitle: "",
                                calories: 0,
                                protein: 0,
                                carbs: 0,
                                fat: 0,
                                isPlaceholder: true,
                              };
                              const meals = sortMealsBySlotOrder([...dpRow.meals, newMeal]);
                              const totals = meals.reduce(
                                (a, m) => ({
                                  calories: a.calories + m.calories,
                                  protein: a.protein + m.protein,
                                  carbs: a.carbs + m.carbs,
                                  fat: a.fat + m.fat,
                                }),
                                { calories: 0, protein: 0, carbs: 0, fat: 0 },
                              );
                              return { ...dpRow, meals, totals };
                            });
                            void persistPlan(next);
                            return next;
                          });
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: Radius.md,
                          borderWidth: 1,
                          borderColor: Accent.primary + "55",
                          backgroundColor: Accent.primary + "12",
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${slot} slot`}
                      >
                        <Plus size={14} color={Accent.primary} strokeWidth={2} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary }}>{slot}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })()}
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
                  void persistPlan(next as DayPlan[]);
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
      <Modal
        visible={portionModal != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPortionModal(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setPortionModal(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              paddingTop: Spacing.md,
              paddingBottom: insets.bottom + Spacing.lg,
              maxHeight: "70%",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm }}>
              Portion size
            </Text>
            {portionModal && plan?.[portionModal.dayIdx]?.meals[portionModal.mealIndex] ? (
              <Text style={{ fontSize: 13, color: colors.textSecondary, paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm }} numberOfLines={2}>
                {plan[portionModal.dayIdx]!.meals[portionModal.mealIndex]!.recipeTitle ||
                  plan[portionModal.dayIdx]!.meals[portionModal.mealIndex]!.name}
              </Text>
            ) : null}
            <FlatList
              data={portionMultiplierList}
              keyExtractor={(m) => String(m)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: mult }) => {
                if (!portionModal || !plan) return <View />;
                const mealAt = plan[portionModal.dayIdx]?.meals[portionModal.mealIndex];
                if (!mealAt) return <View />;
                const curMeta = planMealPortionMeta(mealAt, planRecipePool);
                const cur = curMeta.displayMult;
                const kcal = Math.round((mealAt.calories / cur) * mult);
                return (
                  <Pressable
                    onPress={() => {
                      setPlan((prev) => {
                        if (!prev || !portionModal) return prev;
                        const { dayIdx, mealIndex } = portionModal;
                        const next = prev.map((dp, di) => {
                          if (di !== dayIdx) return dp;
                          const m0 = dp.meals[mealIndex];
                          if (!m0) return dp;
                          const c0 = planMealPortionMeta(m0, planRecipePool).displayMult;
                          const baseCals = m0.calories / c0;
                          const basePro = m0.protein / c0;
                          const baseCarbs = m0.carbs / c0;
                          const baseFat = m0.fat / c0;
                          const baseFiber = (m0.fiberG ?? 0) / c0;
                          const newMeals = dp.meals.map((m, mi) => {
                            if (mi !== mealIndex) return m;
                            return {
                              ...m,
                              calories: Math.round(baseCals * mult),
                              protein: Math.round(basePro * mult),
                              carbs: Math.round(baseCarbs * mult),
                              fat: Math.round(baseFat * mult),
                              fiberG: Math.round(baseFiber * mult * 10) / 10,
                            };
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
                          return { ...dp, meals: newMeals, totals };
                        });
                        void persistPlan(next);
                        return next;
                      });
                      setPortionModal(null);
                    }}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: Spacing.xl,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{mult}×</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>~{kcal} kcal</Text>
                  </Pressable>
                );
              }}
            />
            <Pressable
              onPress={() => setPortionModal(null)}
              style={{ paddingVertical: 16, alignItems: "center" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: Accent.primary }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
