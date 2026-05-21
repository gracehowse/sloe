import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  FlatList,
  InteractionManager,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "@/context/auth";
import { useDiscoverRecipes, useSavedLibraryRecipes } from "@/lib/recipes";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { upsertShoppingListJsonItems } from "@suppr/shared/supabase/shoppingJsonFallback";
import { getMyHousehold } from "@suppr/shared/household/householdClient";
import {
  shoppingScopeFor,
  shoppingScopeInsertStamp,
  shoppingScopeClearFilters,
  type ShoppingScope,
} from "@suppr/shared/household/shoppingScope";
import { dateKeyFromDate, newMealId } from "@/lib/nutritionJournal";
import { snapshotDailyTargetIfMissing } from "@suppr/shared/nutrition/dailyTargetSnapshot";
import { fetchPlannedMealMicros } from "@suppr/shared/planning/plannedMealMicros";
import {
  Check,
  CheckCircle2,
  Circle,
  Coffee,
  ChevronDown,
  ChevronRight,
  Cookie,
  Lock,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings2,
  Sliders,
  Sun,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { Accent, MacroColors, SlotColors, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets } from "@/lib/calcTargets";
import { SkeletonCard } from "@/components/ui/SkeletonRow";
import {
  generateSmartPlan,
  ALL_MEAL_SLOTS,
  DEFAULT_PLANNER_BANDS,
  PORTION_MULTIPLIER_CLAMP,
  type PlannerTargets,
} from "@/lib/mealPlanAlgo";
import { isMealPlanPlaceholderLikeTitle } from "@suppr/shared/nutrition/portionMultiplier";
import { coerceMacrosWhenCaloriesButNoGrams } from "@suppr/shared/nutrition/coerceRecipeMacrosForPlanning";
import {
  findPlanDayIdForCalendarDate,
  planCalendarDateForIndex,
  startDateForOffset,
  stripMidnight,
} from "@suppr/shared/mealPlan/planCalendarAnchor";
import { countChangedMealsInPlan } from "@suppr/shared/mealPlan/planDiff";
import { normalizeShoppingIngredientRow } from "@suppr/shared/planning/normalizeShoppingIngredientRow";
import { formatPlannedMealKcalMacrosLine } from "@suppr/shared/nutrition/plannedMealDisplay";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";
import {
  buildDayTotalVsGoalLine,
  formatDayTotalCell,
  type DayTotalTone,
} from "@suppr/shared/planning/dayTotalVsGoal";
import Badge from "@/components/Badge";
import {
  countLeftoversOfRecipe,
  distributeLeftovers,
  markLeftoversOnSwap,
  moveMealInPlan,
  type LeftoverAwareMeal,
} from "@suppr/shared/nutrition/leftoversPlanner";
import {
  buildTemplateFromWeek,
  applyTemplateToWeek,
  type PlanTemplate,
} from "@suppr/shared/nutrition/planTemplates";
import {
  createPlanTemplate,
  deletePlanTemplate,
  listPlanTemplates,
} from "@suppr/shared/nutrition/planTemplatesClient";
import { normaliseMealSlot } from "@suppr/shared/nutrition/mealSlots";
import {
  isSameCalendarDay,
  resolvePlanSlotIconKey,
  shortWeekdayLabel,
  type PlanSlotIconKey,
} from "@suppr/shared/planning/planDayLabel";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { track } from "@/lib/analytics";
import * as Haptics from "expo-haptics";
import { HouseholdSummaryRow } from "@/components/HouseholdSummaryRow";
import { MoveMealSheet } from "@/components/MoveMealSheet";
import { PlanTemplatesSheet } from "@/components/PlanTemplatesSheet";
import { useMealPlanSlots } from "@/hooks/use-meal-plan-slots";
import { PlanTabChrome } from "@/components/tabs/PlanTabChrome";
import { Layout } from "@/constants/layout";

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

// Colour parity with `TodayMealsSection.tsx` `SLOT_COLOR`. Sourced from
// `SlotColors` so the Snacks tint cannot drift back to magenta and
// collide with `MacroColors.fat` (ui-critic P2 #10, 2026-05-01).
const SLOT_COLOR_MOBILE: Record<PlanSlotIconKey, string> = {
  breakfast: SlotColors.breakfast,
  lunch: SlotColors.lunch,
  dinner: SlotColors.dinner,
  snacks: SlotColors.snack,
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

type PlanRecipeRef = { id: string; title: string; calories: number; image?: string | null };

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
        // Wave-2 (2026-04-30): recipe hero image surfaces in the day-
        // card meal rows so a 7-day plan reads visually instead of as
        // a wall of slot icons. `r.image` is mapped from `image_url`
        // by `useDiscoverRecipes` / `useSavedLibraryRecipes`; falls
        // back to a deterministic default when the source has none.
        image: (r as { image?: string | null }).image ?? null,
      })),
    [savedRecipes, discoverRecipes],
  );

  /**
   * Recipe-wave (2026-05-10): "Defaults to recipes that don't exist".
   *
   * `meal_plans.plan` is JSONB with no FK against `recipes.id`, so a
   * `recipeId` baked into a plan row stays referenceable after the
   * underlying recipe is deleted from the library. Pre-fix the card
   * half-rendered (no image, just the slot icon + title), which read
   * as a broken default.
   *
   * `knownRecipeIds` mirrors the web Set in `MealPlanner.tsx` so each
   * meal-row render can cheaply detect a stale `recipeId` and surface
   * a "Recipe removed" badge instead of pretending the card is whole.
   */
  const knownRecipeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of planRecipePool) ids.add(r.id);
    return ids;
  }, [planRecipePool]);

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
  // Group E Card 4 (premium-bar audit 2026-05-14): regenerate diff
  // toast. When the user taps Regenerate against an existing plan,
  // we snapshot the prior plan in `prevPlanForDiffRef`, run the
  // generator, then count how many meals (by recipeId, falling back
  // to recipeTitle) differ between before/after. The toast surfaces
  // the count for ~2.4s so the user reads the action as "the engine
  // picked N new recipes" rather than "did anything change?". The
  // pattern mirrors `FirstLogAcknowledgment` (one-shot toast, host
  // owns visibility lifecycle).
  const prevPlanForDiffRef = useRef<DayPlan[] | null>(null);
  const [regenerateToast, setRegenerateToast] = useState<{
    visible: boolean;
    changedCount: number;
  } | null>(null);
  useEffect(() => {
    if (!regenerateToast?.visible) return;
    const handle = setTimeout(() => {
      setRegenerateToast(null);
    }, 2400);
    return () => clearTimeout(handle);
  }, [regenerateToast]);
  // 2026-05-14 (premium-bar audit Plan Card 4 #8): when the user
  // taps Regenerate while a plan is already visible, show a soft
  // shimmer overlay over the day-card stack so the surface reads
  // as "working on it" rather than "did anything happen?". 800ms
  // opacity loop matches the SkeletonRow's `Shimmer` cadence so
  // the two pulses don't desync on screens where both appear.
  const generatingPulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (!generating) {
      generatingPulse.setValue(0.45);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(generatingPulse, {
          toValue: 0.18,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(generatingPulse, {
          toValue: 0.45,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [generating, generatingPulse]);
  const [planSlotMenuOpen, setPlanSlotMenuOpen] = useState(false);
  // Default to 7 days — Plan is a week tool, and a 1-day default hides
  // the week-view "wow" behind a tap. Free-tier users see the 3-day /
  // 7-day pickers as locked (existing gate below); the default still
  // lands on the 7-day shape so they understand what they'd unlock.
  // Audit-vs-competitors wave 2 (2026-04-30): customer-lens flagged the
  // 1-day default as "Today with extra steps".
  const [days, setDays] = useState<1 | 3 | 7>(7);
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
  // Wave-2 (2026-04-30): the default day count is 7 (Plan = week tool),
  // but free-tier users can only generate 1-day plans. When the async
  // tier resolves to "free" — and the user hasn't manually changed the
  // pick yet — clamp the chip back to 1 so the picker reflects reality.
  // We track manual interaction via a ref so a Pro user who tapped "1"
  // doesn't get bumped back to 7 on a later effect re-run.
  const userPickedDaysRef = useRef(false);
  useEffect(() => {
    if (isFree && !userPickedDaysRef.current) {
      setDays(1);
    }
  }, [isFree]);
  const [planTargets, setPlanTargets] = useState<{ calories: number; protein: number; carbs: number; fat: number; fiber?: number } | null>(null);
  const [enabledSlots, setEnabledSlots] = useState<Set<string>>(new Set(ALL_MEAL_SLOTS));
  const [shoppingItemCount, setShoppingItemCount] = useState(0);

  // Household-aware shopping (Honeydew parity, 2026-04-30) — resolved
  // once when the user lands on Plan and refreshed if the user joins/
  // leaves a household via the Manage screen. Drives `household_id` on
  // shopping_items writes + the "shared" status on the summary row.
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  // ENG-? (2026-05-14 premium-bar audit Plan Card 2 #5): day-card
  // eyebrow now reads "Mon · Shared" when the user is in a household
  // with >1 member, so the planned meals are anchored to who they're
  // for. Solo households (count <= 1) suppress the suffix — same
  // rule the HouseholdSummaryRow uses to hide its own pill.
  const [householdMemberCount, setHouseholdMemberCount] = useState<number>(1);
  useEffect(() => {
    if (!userId) { setActiveHouseholdId(null); setHouseholdMemberCount(1); return; }
    let cancelled = false;
    const plannerHouseholdTimeout = Symbol("planner_household_timeout");
    void (async () => {
      try {
        const pack = await Promise.race([
          getMyHousehold(supabase as any, userId),
          new Promise<typeof plannerHouseholdTimeout>((resolve) => {
            setTimeout(() => resolve(plannerHouseholdTimeout), 18_000);
          }),
        ]);
        if (cancelled) return;
        if (pack === plannerHouseholdTimeout) {
          if (__DEV__) console.warn("[planner] getMyHousehold timed out — shopping scope falls back to solo");
          setActiveHouseholdId(null);
          setHouseholdMemberCount(1);
          return;
        }
        const { data } = pack;
        setActiveHouseholdId(data?.household?.id ?? null);
        setHouseholdMemberCount(data?.members?.length ?? 1);
      } catch {
        if (!cancelled) { setActiveHouseholdId(null); setHouseholdMemberCount(1); }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
  const isSharedHousehold = householdMemberCount > 1;
  const shoppingScope: ShoppingScope | null = useMemo(() => {
    if (!userId) return null;
    return shoppingScopeFor({ userId, householdId: activeHouseholdId });
  }, [userId, activeHouseholdId]);

  // Batch 3.10 — plan templates state.
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  /** When a plan exists: expand to change day count / slots / start before regenerating. */
  const [planSetupExpanded, setPlanSetupExpanded] = useState(false);
  // 2026-05-13 (premium-bar audit Plan Card 4 #4): instruction copy
  // ("Change options below, then regenerate. Edits to individual
  // meals…") used to render every time the Plan setup was expanded.
  // After the first read it's noise; testers said they tuned it out.
  // Now persisted-dismissable: shown until the user taps the close X,
  // then `suppr-plan-setup-instr-seen-v1` flag in AsyncStorage hides
  // it forever for that device. Set on dismiss; read on mount.
  const PLAN_INSTR_SEEN_KEY = "suppr-plan-setup-instr-seen-v1";
  const [planInstrSeen, setPlanInstrSeen] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(PLAN_INSTR_SEEN_KEY);
        if (!cancelled) setPlanInstrSeen(v === "1");
      } catch {
        if (!cancelled) setPlanInstrSeen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissPlanInstruction = useCallback(() => {
    setPlanInstrSeen(true);
    void AsyncStorage.setItem(PLAN_INSTR_SEEN_KEY, "1").catch(() => undefined);
  }, []);
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
    if (!userId || !shoppingScope) return;
    const prev = priorPlanRef.current;
    priorPlanRef.current = plan;
    if (!plan) {
      setShoppingItemCount(0);
      // Only hit the server when the plan actually transitioned to
      // null this render; avoids a delete on every cold start with
      // no plan (there's nothing to clean up then either).
      // 2026-04-30 — household-aware: solo deletes (`user_id = me AND
      // household_id IS NULL`) so we never wipe a *household* list when
      // a single member's plan empties; household deletes (`household_id
      // = active`) wipe the shared list deliberately when the cook
      // who built it clears their plan.
      if (prev) {
        const filters = shoppingScopeClearFilters(shoppingScope);
        let q = supabase.from("shopping_items").delete();
        if (filters.household_id !== undefined && filters.household_id !== null) {
          q = q.eq("household_id", filters.household_id);
        }
        if (filters.user_id !== undefined) {
          q = q.eq("user_id", filters.user_id);
        }
        if (filters.household_id === null) {
          q = q.is("household_id", null);
        }
        void q;
      }
      return;
    }
    let countQ = supabase
      .from("shopping_items")
      .select("id", { count: "exact", head: true });
    if (shoppingScope.kind === "household") {
      countQ = countQ.eq("household_id", shoppingScope.householdId);
    } else {
      countQ = countQ.eq("user_id", shoppingScope.userId).is("household_id", null);
    }
    countQ.then(({ count }) => {
      setShoppingItemCount(count ?? 0);
    });
  }, [userId, plan, shoppingScope]);

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
        // Schema refactor Phase 3 (2026-05-11) — legacy JSONB upsert
        // fallback removed (table dropped 2026-04-21; RPC has been in
        // production since 2026-04-24). 42883 / missing-table now
        // surface as a real save failure that we log.
        if (__DEV__) {
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
        scroll: {
          paddingHorizontal: Layout.screenPaddingX,
          paddingTop: Spacing.md,
          paddingBottom: Layout.screenPaddingBottom,
          gap: Layout.screenGap,
        },
        // Prototype port — uppercase micro-overline above the big title.
        headerOverline: {
          fontSize: 11,
          fontWeight: "700",
          color: colors.textTertiary,
          letterSpacing: 1.2,
          textTransform: "uppercase",
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
          marginBottom: Spacing.xl,
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
          marginBottom: Spacing.xl,
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
          marginTop: Spacing.md,
          marginBottom: Spacing.md,
        },

        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          gap: Spacing.lg,
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
        // 2026-05-13 (premium-bar audit Plan Card 6 #2): active tint
        // was `+ "15"` (8.2% opacity) which read as nearly invisible in
        // dark mode and weakly tinted in light. Bumped to `+ "26"`
        // (≈15%) so the active state lifts visibly above the card
        // surface in both themes without dominating like a solid fill.
        dayBtnActive: { borderColor: Accent.primary, backgroundColor: Accent.primary + "26" },
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
        // 2026-05-14 (premium-bar audit Plan Card 2 #5) — companion
        // to `dayTodayPill`, signals the day-card is part of a shared
        // household plan. Subdued grey so it reads as scope context,
        // not as a CTA.
        daySharedPill: {
          fontSize: 10,
          fontWeight: "700",
          color: colors.textTertiary,
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
          paddingHorizontal: 10,
          minWidth: 90,
          borderRadius: 8,
          backgroundColor: `${Accent.primary}14`,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 4,
        },
        mealLogBtnText: { fontSize: 11, fontWeight: "600", color: Accent.primary, textAlign: "center" },
        // 2026-05-14 (premium-bar audit Plan Card 2 #4) — `…` overflow
        // sits adjacent to the primary Log-as-planned button and opens
        // an action sheet with the same actions long-press exposes.
        // Matches the swap-button size/visual so the right-side action
        // cluster reads as a single trio: swap, log, more.
        mealOverflowBtn: {
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: colors.border + "66",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 3,
        },
        // 2026-05-14 (premium-bar audit Plan Card 2 #1) — per-row fit
        // chip ("Fits 92%" / "Over by 220 kcal"). Shape mirrors the
        // portion-multiplier pill rendered next to the recipe title.
        mealFitPill: {
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 4,
          alignSelf: "flex-start",
          marginTop: 4,
        },
        mealFitPillText: {
          fontSize: 11,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        },
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
      //
      // 2026-05-15: one round-trip via nested PostgREST embed instead
      // of two. FK `meal_plan_meals_plan_day_id_fkey` lets the embed
      // resolve cleanly (see database.types.ts).
      const { data: dayRows, error: dayErr } = await supabase
        .from("meal_plan_days")
        .select(
          "id, day, start_date, meals:meal_plan_meals(plan_day_id, slot_index, name, recipe_title, calories, protein, carbs, fat, portion_multiplier, is_placeholder)",
        )
        .eq("user_id", userId)
        .eq("slot_id", "default")
        .order("day", { ascending: true });

      if (!cancelled && dayRows && dayRows.length > 0 && !dayErr) {
        const plans: DayPlan[] = dayRows.map((d: { id: string; day: number; meals?: Array<Record<string, unknown>> | null }) => {
          const dayMeals = (d.meals ?? []).slice().sort((a, b) => (((a.slot_index as number) ?? 0) - ((b.slot_index as number) ?? 0)));
          const meals = stripPlanPlaceholders(
            dayMeals.map((m) => {
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

      // Schema refactor Phase 3 (2026-05-11) — legacy `meal_plans`
      // JSONB fallback removed (table dropped 2026-04-21). Plans come
      // exclusively from `meal_plan_days` + `meal_plan_meals` above.
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
        const normalized = normalizeShoppingIngredientRow({
          name: String(ing.name ?? ""),
          amount: ing.amount != null ? String(ing.amount) : "",
          unit: String(ing.unit ?? ""),
        });
        const key = `${normalized.name.toLowerCase().trim()}|${normalized.unit.toLowerCase().trim()}`;
        const multiplier = recipeCounts[ing.recipe_id] ?? 1;
        const parsed = Number.parseFloat(normalized.amount);
        const baseAmount = Number.isFinite(parsed) ? parsed : 1;
        const existing = merged.get(key);
        if (existing) {
          existing.amount += baseAmount * multiplier;
          existing.from.add(recipeTitles[ing.recipe_id] ?? "");
        } else {
          merged.set(key, {
            name: normalized.name,
            amount: baseAmount * multiplier,
            unit: normalized.unit,
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

      // Honeydew parity (2026-04-30) — stamp `household_id` so generated
      // items show up for every household member instantly; solo users
      // keep `household_id = null` and fall through the per-user RLS.
      const stamp = shoppingScope
        ? shoppingScopeInsertStamp(shoppingScope)
        : { user_id: userId, household_id: null as string | null };
      const inserts = items.map((item) => ({
        user_id: stamp.user_id,
        household_id: stamp.household_id,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        category: item.category,
        checked: item.checked,
        source: item.source,
      }));

      // Scope-aware delete: household lists wipe by `household_id` so a
      // member regenerating doesn't leave another member's stale items
      // behind; solo lists wipe by `user_id` + `household_id IS NULL`.
      let delQ = supabase.from("shopping_items").delete();
      if (shoppingScope?.kind === "household") {
        delQ = delQ.eq("household_id", shoppingScope.householdId);
      } else {
        delQ = delQ.eq("user_id", userId).is("household_id", null);
      }
      const { error: delErr } = await delQ;
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
    [userId, savedRecipes, discoverRecipes, shoppingScope],
  );

  const generatePlan = useCallback(async () => {
    if (savedRecipes.length === 0 && discoverRecipes.length === 0) {
      Alert.alert("No recipes available", "Save at least 1 recipe from Discover to generate a plan.");
      return;
    }

    // Group E Card 4 (premium-bar audit 2026-05-14): snapshot the
    // existing plan BEFORE regeneration so the post-generation diff
    // toast can count how many meals changed. We deep-copy the meals
    // array (shallow ref would mutate when `setPlan` replaces the
    // state below) so the comparison reads the pre-regenerate
    // recipes, not the new ones we're about to write.
    prevPlanForDiffRef.current = plan
      ? plan.map((dp) => ({
          ...dp,
          meals: dp.meals.map((m) => ({ ...m })),
        }))
      : null;

    setGenerating(true);
    // F-114 broader sweep (2026-05-07): wrap the whole generation +
    // persistence body in try/finally so a throw at any await point
    // (profiles fetch, save_meal_plan RPC, shopping rebuild) flips the
    // regenerate spinner off. Pre-fix the explicit setGenerating(false)
    // at the happy-path tail meant any rejection between setGenerating
    // (true) and that line stranded the button spinning forever.
    try {

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
    if (userId && shoppingScope) {
      try {
        // 2026-04-30 (Honeydew parity): scope-aware wipe. Household
        // members regenerating fresh-bin the *household* row set —
        // not the cook's solo rows — so the shared list is consistent.
        let q = supabase.from("shopping_items").delete();
        if (shoppingScope.kind === "household") {
          q = q.eq("household_id", shoppingScope.householdId);
        } else {
          q = q.eq("user_id", userId).is("household_id", null);
        }
        await q;
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

      // Group E Card 4 (premium-bar audit 2026-05-14): count how
      // many meal slots changed (different recipe vs. the snapshot
      // taken at the top of this callback) and surface the count
      // as a soft toast. Identity is recipeId-first, with recipeTitle
      // as the fallback for placeholder slots that never resolved
      // to a saved recipe — see `countChangedMealsInPlan` in
      // `src/lib/mealPlan/planDiff.ts`. If the prior plan was empty
      // (first-time generation) we skip the toast — there's nothing
      // to compare against, the empty-state CTA already covers that
      // beat.
      const prevPlan = prevPlanForDiffRef.current;
      if (prevPlan && prevPlan.length > 0) {
        const changed = countChangedMealsInPlan(prevPlan, newPlan);
        if (changed > 0) {
          setRegenerateToast({ visible: true, changedCount: changed });
        }
      }
      prevPlanForDiffRef.current = null;

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
            // Schema refactor Phase 3 (2026-05-11) — legacy JSONB
            // upsert fallback removed.
            if (__DEV__) {
              console.warn("[persistPlan/regenerate] save_meal_plan failed:", error.message);
            }
          }
        })();
      }
    }
    } catch (err) {
      console.error("[planner] generatePlan failed:", err);
      Alert.alert(
        "Couldn't generate plan",
        "Something went wrong while building your plan. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }, [savedRecipes, days, userId, enabledSlots]);

  return (
    <View
      testID="screen-planner"
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Group E Card 4 (premium-bar audit 2026-05-14): regenerate
          diff toast. Absolutely positioned overlay below the status
          bar so it doesn't compete for header space. Auto-dismisses
          after 2.4s via the effect on `regenerateToast`. Hosts no
          tap target — calm-reward posture matching
          `FirstLogAcknowledgment`. */}
      {regenerateToast?.visible ? (
        <View
          testID="planner-regenerate-toast"
          accessibilityRole="alert"
          accessibilityLabel={`Plan updated. ${regenerateToast.changedCount} meals changed.`}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + Spacing.sm,
            left: Spacing.md,
            right: Spacing.md,
            zIndex: 1000,
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            borderRadius: Radius.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: Accent.primary + "40",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: Accent.primary + "1A",
            }}
          >
            <RefreshCw size={14} color={Accent.primary} strokeWidth={2.25} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: "600",
              color: colors.text,
              letterSpacing: -0.1,
            }}
          >
            Plan updated — {regenerateToast.changedCount}{" "}
            {regenerateToast.changedCount === 1 ? "meal" : "meals"} changed
          </Text>
        </View>
      ) : null}
      {/* Phase 2 / B1.1 — Plan sub-tab pill bar (Plan default,
          Shopping list as a sub-view). Tapping "Shopping" routes to
          the existing `/shopping` screen which carries a mirroring
          header so the user can return without losing their place. */}
      <PlanTabChrome
        value="plan"
        subtitle={getWeekOfLabel()}
        onChange={(next) => {
          if (next === "shopping") {
            router.push("/shopping" as Href);
          }
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.headerRow, { justifyContent: "flex-end" }]}>
          {/* F-29 (2026-04-21): Regenerate was previously only reachable
              via the "This week" summary card, which hides when
              summaryScore is null (e.g. empty-day view, no planTargets).
              TestFlight AAtQgwFWaQTF — "regenerate section is missing".
              Surface the action at the header level whenever a plan
              exists so it's always one tap away. */}
          {/* Group E Card 1 (premium-bar audit 2026-05-14): the two
              circular header buttons (Regenerate + Plan options) are
              icon-only — without an a11y label the screen reader
              announces them as anonymous buttons. Each carries a
              descriptive accessibilityLabel naming the action and a
              short accessibilityHint explaining the outcome so
              VoiceOver / TalkBack users get the same context sighted
              users get from the icon shape. accessibilityRole="button"
              + state guards (disabled spinner) are already in place. */}
          {plan && plan.length > 0 ? (
            <Pressable
              style={[styles.headerIconBtn, { marginRight: 8 }]}
              onPress={generatePlan}
              disabled={generating}
              accessibilityRole="button"
              accessibilityLabel="Regenerate this week's meal plan"
              accessibilityHint="Rebuilds the plan with a fresh combination of your saved recipes"
              accessibilityState={{ disabled: generating, busy: generating }}
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
            accessibilityLabel="Plan settings and templates"
            accessibilityHint="Opens plan-setup controls: meal slots, day count, saved templates"
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
          contentContainerStyle={{ gap: 8, paddingBottom: 6, paddingRight: 4 }}
          style={{ marginBottom: Spacing.lg }}
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
            {/* 2026-05-12 (premium-bar audit Plan Card 1): eyebrow
                upgraded from generic "This week" → "{start} – {end} ·
                Meal plan" so users see the actual span of the plan
                they're looking at. Matches the audit's example
                ("May 7 – 13 · Meal plan"). Falls back to "This week"
                when the date math can't resolve (defensive). */}
            <Text style={styles.summaryOverline}>
              {(() => {
                try {
                  const planLen = plan.length;
                  const first = planCalendarDateForIndex(0, startOffset);
                  const last = planCalendarDateForIndex(planLen - 1, startOffset);
                  const fmt = (d: Date) =>
                    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  if (first.getMonth() === last.getMonth()) {
                    return `${fmt(first)} – ${last.getDate()} · Meal plan`;
                  }
                  return `${fmt(first)} – ${fmt(last)} · Meal plan`;
                } catch {
                  return "This week";
                }
              })()}
            </Text>
            <Text style={styles.summaryTitle}>
              {`Hits your targets ${summaryScore.hits} of ${summaryScore.total} day${summaryScore.total === 1 ? "" : "s"}`}
            </Text>
            <Text style={styles.summarySubtitle}>
              {summaryScore.hits === summaryScore.total
                ? `All ${summaryScore.total} day${summaryScore.total === 1 ? "" : "s"} land on target.`
                : summaryScore.worstShort
                  ? `${WEEKDAY_LONG[planCalendarDateForIndex(summaryScore.worstShort.dayIndex, startOffset).getDay()]} is ~${Math.round(summaryScore.worstShort.shortBy)} kcal short. Add a snack or swap the dinner.`
                  : "Some days run over target. Tap a meal to swap or adjust the portion."}
            </Text>
            {/* 2026-05-14 (premium-bar audit Plan Card 4 #6 + #7):
                "Shopping list" was dropped from the summary card —
                it remained accessible via the dedicated CTA card
                below and the tab bar, so duplicating it as the
                primary action here was a duplicate-CTA papercut.
                Regenerate is now primary; a secondary "Adjust
                constraints" expands the Plan-setup card directly
                so the user can change day count / start / slots
                without scrolling to find the disclosure. */}
            <View style={styles.summaryActions}>
              <Pressable
                style={styles.summaryPrimaryBtn}
                onPress={generatePlan}
                disabled={generating}
                accessibilityRole="button"
                accessibilityLabel="Regenerate plan"
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <RefreshCw size={14} color="#fff" strokeWidth={1.75} />
                    <Text style={styles.summaryPrimaryText}>Regenerate</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.summarySecondaryBtn}
                onPress={() => setPlanSetupExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Adjust plan constraints"
                testID="plan-summary-adjust-constraints"
              >
                <Sliders size={14} color={colors.text} strokeWidth={1.75} />
                <Text style={styles.summarySecondaryText}>Adjust constraints</Text>
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
                {/* 2026-05-13 (premium-bar audit Plan Card 4 #4): the
                    instruction copy now renders only until the user
                    dismisses it. After dismissal, the
                    `suppr-plan-setup-instr-seen-v1` flag keeps it
                    hidden on that device forever. Reduces repeat-
                    visit noise on the Plan tab while still giving
                    first-time users the orientation. */}
                {planSetupExpanded && !planInstrSeen ? (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 }}>
                    <Text style={[styles.cardDesc, { flex: 1, marginTop: 0 }]}>
                      Change options below, then regenerate. Edits to individual meals (swap, portion, clear) apply immediately.
                    </Text>
                    <Pressable
                      onPress={(e) => {
                        // Stop the parent header's expand/collapse
                        // toggle from firing when the user just wants
                        // to dismiss the tooltip.
                        e.stopPropagation?.();
                        dismissPlanInstruction();
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss tip"
                      testID="plan-setup-instr-dismiss"
                      style={{ padding: 2 }}
                    >
                      <X size={14} color={colors.textTertiary} strokeWidth={2} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
              {/* 2026-05-12 (premium-bar audit Plan Card 1): replaced
                  the raw "▶ / ▼" Unicode glyphs with lucide chevrons
                  matching the rest of the app's disclosure pattern.
                  The Unicode markers read as placeholder; the proper
                  chevron icon is the prototype + design-system spec. */}
              {/* 2026-05-13 (premium-bar audit Plan Card 6 #3): chevron
                  used `textSecondary` which read as faded against the
                  card surface in dark mode — testers reported the
                  expander affordance disappeared at a glance. Bumped
                  to `text` so the chevron carries the same weight as
                  the card title in both themes. */}
              {planSetupExpanded ? (
                <ChevronDown size={18} color={colors.text} strokeWidth={2.25} />
              ) : (
                <ChevronRight size={18} color={colors.text} strokeWidth={2.25} />
              )}
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
                          userPickedDaysRef.current = true;
                          setDays(d);
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={[styles.dayBtnText, days === d && styles.dayBtnTextActive]}>
                            {d} day{d > 1 ? "s" : ""}
                          </Text>
                          {locked ? (
                            <Lock
                              size={11}
                              color={days === d ? Accent.success : Accent.warning}
                              strokeWidth={2}
                              accessibilityLabel="Pro only"
                            />
                          ) : null}
                        </View>
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
                        {/* 2026-05-06 (Grace) — was `color="#fff"` on
                            an `Accent.primary + "15"` tinted background
                            (~8% opacity). White-on-very-light-blue made
                            the check icon invisible. Both states now
                            use a colour that contrasts against the
                            chip's tinted background: active uses the
                            primary blue (matches `dayBtnTextActive`);
                            inactive stays muted text-secondary. */}
                        {active ? (
                          <CheckCircle2 size={14} color={Accent.primary} strokeWidth={2} style={{ marginRight: 4 }} />
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
            {/* DC12 (2026-05-14, premium-bar audit) — low-emotion
                empty state. Linear/direct copy: tells the user what
                they're looking at (no plan yet) and what to do
                (generate one), with the 30-second time signal that
                a returning MFP/Lose It refugee will instantly read
                as "this won't be a 10-minute chore". Web parity:
                `src/app/components/PlannerScreen.tsx`. */}
            <Text style={styles.cardTitle}>No plan yet</Text>
            <Text style={styles.cardDesc}>
              Generate one in 30 seconds. {savedRecipes.length} recipe{savedRecipes.length !== 1 ? "s" : ""} in your library.
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
                      userPickedDaysRef.current = true;
                      setDays(d);
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={[styles.dayBtnText, days === d && styles.dayBtnTextActive]}>
                        {d} day{d > 1 ? "s" : ""}
                      </Text>
                      {locked ? (
                        <Lock
                          size={11}
                          color={days === d ? Accent.success : Accent.warning}
                          strokeWidth={2}
                          accessibilityLabel="Pro only"
                        />
                      ) : null}
                    </View>
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {/* 2026-05-13 (premium-bar audit Plan Card 4 —
                      7-dot stacked viz inline with headline):
                      replaces the bare `<ActivityIndicator>` with
                      a 7-dot ribbon (one dot per day of the
                      week-long plan) plus the "Building your
                      plan…" headline. Gives the user honest
                      signal that the engine is filling days, not
                      just spinning. The dot ribbon uses opacity
                      to imply sequential fill without per-dot
                      animation (which would need reanimated state
                      threading on this hot path — overkill for a
                      6–10s job). */}
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <View
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: "#fff",
                          opacity: 0.35 + (i / 7) * 0.6,
                        }}
                      />
                    ))}
                  </View>
                  <Text style={styles.generateBtnText}>Building your plan…</Text>
                </View>
              ) : (
                /* DC12 (2026-05-14, premium-bar audit) — linear/direct
                   primary CTA. "Generate Plan" was abstract; "Generate
                   my plan" reads as the user's action (their plan, not
                   the system's). */
                <Text style={styles.generateBtnText}>Generate my plan</Text>
              )}
            </Pressable>
          </View>
        )}

        {plan && plan.length > 0 && (
          <View
            style={{
              marginBottom: Spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: Spacing.sm,
            }}
          >
            <Text style={styles.sectionLabel}>
              {plan.length === 1
                ? `${WEEKDAY_LONG[planCalendarDateForIndex(0, startOffset).getDay()]}'s plan`
                : `Your ${plan.length}-day plan`}
            </Text>
            {/* 2026-05-13 (premium-bar audit Plan Card 1 #6): demoted
                "Browse recipe library" from a full-width primary-tinted
                pressable into a small secondary chip sitting beside the
                section label. The link was the same visual weight as
                the section title which made the page eyebrow row look
                like two competing headers. Same destination, quieter
                affordance. */}
            <Pressable
              onPress={() => router.push("/(tabs)/library" as Href)}
              accessibilityRole="button"
              accessibilityLabel="Browse recipe library"
              hitSlop={8}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>
                Browse library →
              </Text>
            </Pressable>
          </View>
        )}

        {/* 2026-05-13 (premium-bar audit Plan Card 4 #5 — Generation
            skeleton state): when the user taps "Generate Plan" with
            no existing plan, render 3 skeleton day-cards below the
            generate button so the surface reads as "the plan is on
            its way" rather than "nothing happened yet". Skipped when
            an existing plan is visible (regenerate path) — the user
            already has visual content during the swap. Matches the
            Recipe verify flow's anticipation-beat pattern. */}
        {generating && (!plan || plan.length === 0) ? (
          <View testID="planner-generation-skeleton" style={{ gap: Spacing.md }}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} hero={false} lines={3} />
            ))}
          </View>
        ) : null}

        {/* Plan display
            2026-05-14 (premium-bar audit Plan Card 4 #8): the plan
            stack is wrapped in a relative container so that, during
            regenerate (when an existing plan is already visible), a
            shimmering brand-tinted overlay can sit over the day-cards
            without unmounting them. The overlay is `pointerEvents="none"`
            so taps still reach the underlying rows — by design we don't
            block interaction during regenerate; we just signal "new
            plan incoming". The cold-start path (no existing plan)
            still shows the 3 SkeletonCards above. */}
        {plan && (
          <View style={{ position: "relative", gap: Spacing.xl }}>
        {plan.map((dp, dayIdx) => {
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
                {/* 2026-05-14 (premium-bar audit Plan Card 2 #5):
                    anchor household scope in the day-card eyebrow
                    when the user is in a >1-member household, so
                    each day's plan reads as "this is for the
                    household, not just me". Solo households
                    suppress the suffix. */}
                {isSharedHousehold && (
                  <Text
                    accessibilityLabel="Shared with household"
                    style={styles.daySharedPill}
                  >
                    · SHARED
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
                      {isClose ? (
                        <Check size={11} color={Accent.success} strokeWidth={3} />
                      ) : (
                        <Text style={{ fontSize: 10, color: diff > 0 ? Accent.destructive : Accent.warning }}>
                          {diff > 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`}
                        </Text>
                      )}
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
              <Text style={{ fontSize: 14, color: colors.textSecondary, paddingVertical: Spacing.md, lineHeight: 20 }}>
                No slots on this day yet. Add one below, or regenerate the plan.
              </Text>
            ) : null}
            {(() => {
              const sortedMeals = sortMealsBySlotOrder(dp.meals);
              // 2026-05-14 (premium-bar audit Plan Card 2 #1): cumulative
              // kcal up to and including each row, used to render a
              // per-row fit pill ("Fits 92%" / "Over by 220 kcal").
              // Computed in slot order so the fit value reflects how
              // the day is filling up as the user reads downward.
              let running = 0;
              const cumKcal = sortedMeals.map((m) => {
                if (planMealHasRecipe(m) && Number.isFinite(m.calories)) {
                  running += m.calories || 0;
                }
                return running;
              });
              return sortedMeals.map((meal, sortedIdx) => {
              const mealIndexInDay = dp.meals.indexOf(meal);
              const multMeta = planMealPortionMeta(meal, planRecipePool);
              const currentMult = multMeta.displayMult;
              const multLabel = multMeta.label;
              const dayCalGoal = planTargets?.calories ?? 0;
              const cumKcalForRow = cumKcal[sortedIdx] ?? 0;
              const showFitPill =
                planMealHasRecipe(meal) &&
                Number.isFinite(meal.calories) &&
                meal.calories > 0 &&
                dayCalGoal > 0;
              const overByKcal = cumKcalForRow - dayCalGoal;
              const fitPctRaw = dayCalGoal > 0 ? (cumKcalForRow / dayCalGoal) * 100 : 0;
              const fitPct = Math.round(fitPctRaw);
              const fitOver = overByKcal > 0;
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
                              text: "Change portion size…",
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
                              text: "Change portion size…",
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
                {/* Prototype port (2026-04-20) — 36×36 thumbnail on the
                    left of every meal row. Wave-2 (2026-04-30): when the
                    meal has a recipe with a hero image, render that
                    image so a multi-day plan reads as a visual scan of
                    actual meals (not a column of identical slot icons).
                    Falls back to the slot icon-box when no recipe (empty
                    slot) or no image (default-pack recipe with the same
                    hero across IDs). Slot icon-box still uses the shared
                    `resolvePlanSlotIconKey` so legacy / voice-parsed
                    slot text lands on the right icon. */}
                {(() => {
                  const slotKey = resolvePlanSlotIconKey(meal.name);
                  const Icon = SLOT_ICON_MOBILE[slotKey];
                  const tint = SLOT_COLOR_MOBILE[slotKey];
                  const ref =
                    (meal.recipeId
                      ? planRecipePool.find((r) => r.id === meal.recipeId)
                      : undefined) ??
                    planRecipePool.find(
                      (r) => r.title.trim() === meal.recipeTitle.trim(),
                    );
                  const imageUri = ref?.image ?? null;
                  if (planMealHasRecipe(meal) && imageUri) {
                    return (
                      <Image
                        source={{ uri: imageUri }}
                        accessibilityLabel={`${meal.recipeTitle} thumbnail`}
                        style={[
                          styles.mealIconBox,
                          { backgroundColor: tint + "22" },
                        ]}
                        resizeMode="cover"
                      />
                    );
                  }
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
                      // 2026-05-13 (premium-bar audit Plan Card 2 #4):
                      // pill now reads `0.5× portion` (not bare `0.5×`)
                      // so users without context know what the chip means.
                      // Compact enough to keep on one line at typical
                      // recipe-title lengths.
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 4,
                          backgroundColor: Accent.primary + "1A",
                          flexShrink: 0,
                        }}
                        accessibilityLabel={`${multLabel} times portion`}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: Accent.primary,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {`${multLabel}× portion`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {/* ENG-64 (2026-05-13): the macro line is dense
                      enough that `numberOfLines={1}` clipped mid-
                      token on narrow phones ("…· F…"), hiding Fat
                      and Fiber values. Allow 2 lines so the wrap
                      breaks cleanly on the " · " separator between
                      tokens rather than mid-abbreviation. The
                      adjacent title above is still `numberOfLines={1}`
                      so the meal name stays single-line and only
                      the informational macro line wraps. */}
                  {/* 2026-05-14 (premium-bar audit Plan Card 2 #3):
                      meal row macro line shows all four macros via the
                      shared `formatPlannedMealKcalMacrosLine` helper —
                      "NNN kcal · P NNg · C NNg · F NNg". Rounding is
                      centralised through `formatMacro` inside the
                      helper so we never drift to "105.80000000000001g"
                      on RN floats. */}
                  <Text style={styles.mealMacros} numberOfLines={2}>
                    {planMealHasRecipe(meal)
                      ? formatPlannedMealKcalMacrosLine(
                          meal.calories,
                          meal.protein,
                          meal.carbs,
                          meal.fat,
                        )
                      : `${formatMacro(0, "calories")} kcal · P —g · C —g · F —g`}
                  </Text>
                  {/* 2026-05-14 (premium-bar audit Plan Card 2 #1) — per-
                      row fit chip. "Fits N%" when running day total
                      stays at or below the day's kcal goal; "Over by
                      N kcal" once cumulative exceeds the goal. Hidden
                      when the row has no kcal or the user has no
                      daily kcal target. Amber tint on over (matches
                      the over-budget rule from
                      project_prototype_carryover_rules — never red). */}
                  {showFitPill ? (
                    <View
                      style={[
                        styles.mealFitPill,
                        {
                          backgroundColor: fitOver
                            ? Accent.warning + "1F"
                            : Accent.success + "1F",
                        },
                      ]}
                      accessibilityLabel={
                        fitOver
                          ? `Over the daily target by ${Math.round(overByKcal)} kilocalories at this row`
                          : `Fits ${fitPct}% of the daily target at this row`
                      }
                      testID={`meal-fit-pill-${dp.day}-${mealIndexInDay}`}
                    >
                      <Text
                        style={[
                          styles.mealFitPillText,
                          { color: fitOver ? Accent.warning : Accent.success },
                        ]}
                      >
                        {fitOver
                          ? `Over by ${Math.round(overByKcal)} kcal`
                          : `Fits ${fitPct}%`}
                      </Text>
                    </View>
                  ) : null}
                  {/* Recipe-wave (2026-05-10) — "Recipe removed" badge
                      for plan rows whose `recipeId` is set but no
                      longer resolves to any known recipe. Pre-fix the
                      card silently dropped to a no-image fallback,
                      reading as a broken default. Now the state is
                      explained so the user can swap or remove the
                      slot. Placeholder rows (no recipeId) intentionally
                      stay silent. */}
                  {planMealHasRecipe(meal) &&
                  meal.recipeId &&
                  !knownRecipeIds.has(meal.recipeId) ? (
                    <View
                      testID="planner-recipe-removed-badge"
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        alignSelf: "flex-start",
                        marginTop: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: colors.textTertiary + "1A",
                      }}
                      accessibilityLabel="Recipe no longer in your library"
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: colors.textTertiary,
                        }}
                      >
                        Recipe removed
                      </Text>
                    </View>
                  ) : null}
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
                    // F-74 follow-up (2026-05-07, repo-auditor flag): the
                    // "Log today" path was writing only the big-four
                    // macros — fiber / sugar / sodium were silently
                    // dropped vs the recipe-detail "Add to today" path
                    // which already persists them. Pull them from the
                    // recipe row at log time (same shape as
                    // `logPlannedMealWithPortion` in Today). Caffeine /
                    // alcohol are still absent because `recipes` doesn't
                    // store them aggregated — see recipe/[id].tsx for
                    // the documented gap.
                    const microsRes = meal.recipeId
                      ? await fetchPlannedMealMicros(
                          supabase as unknown as Parameters<typeof fetchPlannedMealMicros>[0],
                          meal.recipeId,
                          1,
                        )
                      : { fiberG: null, micros: {}, macrosAreCoerced: false };
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
                        fiber_g: microsRes.fiberG,
                        ...(Object.keys(microsRes.micros).length > 0
                          ? { nutrition_micros: microsRes.micros }
                          : {}),
                        portion_multiplier: 1,
                      });
                    if (error) {
                      console.error("[planner] log entry failed:", error.message);
                      Alert.alert("Log failed", "Could not save to tracker. " + error.message);
                    } else {
                      // F-2 — snapshot today's target on first log.
                      void snapshotDailyTargetIfMissing(supabase, userId);
                      // DC12 (2026-05-14, premium-bar audit) —
                      // specific log confirmation. Surfaces the meal
                      // name in the title; body holds the routing
                      // context. Mobile parity sweep.
                      Alert.alert(`${meal.recipeTitle} logged`, "Added to today's tracker.");
                    }
                  }}
                  style={styles.mealLogBtn}
                >
                  {/* V6 (2026-05-11 visual sweep) — "Log today" → "Log"
                      so the meal title stops getting clipped to
                      "Peanut Butter Prot..." on standard iPhone widths.
                      "Today" is redundant context (the user is already
                      viewing today's row in the planner).
                      2026-05-14 (premium-bar audit Plan Card 2 #4):
                      relabelled to "Log as planned" to disambiguate
                      against the overflow menu's "Change portion size…"
                      / "Move to different meal" alternatives. */}
                  <Text style={styles.mealLogBtnText} numberOfLines={1}>Log as planned</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    // 2026-05-14 (premium-bar audit Plan Card 2 #4):
                    // overflow menu that surfaces the same actions
                    // long-press already exposes. Primary "Log as
                    // planned" stays as the dedicated button; "…"
                    // gives keyboard-shy testers a tappable affordance
                    // for "Change portion size…" / "Move to different
                    // meal" / "Remove from plan" without having to
                    // discover the long-press gesture.
                    const hasRecipeOv = planMealHasRecipe(meal);
                    const sourceDayOv = plan?.[dayIdx]?.day;
                    Alert.alert(
                      hasRecipeOv ? meal.recipeTitle! : meal.name,
                      hasRecipeOv ? `${Math.round(meal.calories)} kcal · ${meal.name}` : "Empty slot",
                      [
                        ...(hasRecipeOv
                          ? [
                              {
                                text: "Log as planned",
                                onPress: async () => {
                                  const dk = dateKeyFromDate(new Date());
                                  const entryId = newMealId();
                                  const microsResOv = meal.recipeId
                                    ? await fetchPlannedMealMicros(
                                        supabase as unknown as Parameters<typeof fetchPlannedMealMicros>[0],
                                        meal.recipeId,
                                        1,
                                      )
                                    : { fiberG: null, micros: {}, macrosAreCoerced: false };
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
                                      fiber_g: microsResOv.fiberG,
                                      ...(Object.keys(microsResOv.micros).length > 0
                                        ? { nutrition_micros: microsResOv.micros }
                                        : {}),
                                      portion_multiplier: 1,
                                    });
                                  if (error) {
                                    Alert.alert("Log failed", "Could not save to tracker. " + error.message);
                                  } else {
                                    void snapshotDailyTargetIfMissing(supabase, userId);
                                    // DC12 (2026-05-14, premium-bar audit) —
                      // specific log confirmation. Surfaces the meal
                      // name in the title; body holds the routing
                      // context. Mobile parity sweep.
                      Alert.alert(`${meal.recipeTitle} logged`, "Added to today's tracker.");
                                  }
                                },
                              },
                              {
                                text: "Change portion size…",
                                onPress: () => setPortionModal({ dayIdx, mealIndex: mealIndexInDay }),
                              },
                            ]
                          : []),
                        {
                          text: "Move to different meal",
                          onPress: () => {
                            if (!hasRecipeOv) {
                              Alert.alert("Nothing to move", "This slot is empty.");
                              return;
                            }
                            if (sourceDayOv == null || mealIndexInDay < 0) return;
                            setMoveSource({ day: sourceDayOv, slotIndex: mealIndexInDay });
                            setMoveSheetOpen(true);
                          },
                        },
                        {
                          text: "Remove from plan",
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
                  style={styles.mealOverflowBtn}
                  accessibilityRole="button"
                  accessibilityLabel="More actions for this meal"
                  testID={`meal-overflow-${dp.day}-${mealIndexInDay}`}
                >
                  <MoreHorizontal size={16} color={colors.textSecondary} strokeWidth={1.75} />
                </Pressable>
              </Pressable>
            );
            });
            })()}
            {(() => {
              const missing = canonicalSlotsMissingFromDay(dp.meals);
              if (missing.length === 0) return null;
              return (
                <View
                  style={{
                    marginTop: Spacing.md,
                    paddingTop: Spacing.md,
                    paddingBottom: Spacing.xs,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: Spacing.md }}>
                    Add a meal slot
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
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
                          paddingVertical: 10,
                          paddingHorizontal: 14,
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
            {/* Regenerate-in-flight overlay (Plan Card 4 #8). Brand
                primary gradient hint via two stacked tinted layers
                — the LinearGradient package isn't installed on this
                surface (see comment on `summaryCard`), so we approximate
                with two semi-opaque layers using primary + fat tints.
                Animated opacity pulses both layers in unison via the
                `generatingPulse` value. Cold-start path is handled
                above via SkeletonCards. */}
            {generating ? (
              <Animated.View
                pointerEvents="none"
                testID="planner-regenerate-shimmer"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: Radius.lg,
                  opacity: generatingPulse,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: Accent.primary + "26",
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: MacroColors.fat + "12",
                  }}
                />
              </Animated.View>
            ) : null}
          </View>
        )}

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

                  // Build inserts — omit id so Supabase auto-generates UUIDs.
                  // 2026-04-30 (Honeydew parity): stamp `household_id`
                  // when in a household so the list is shared.
                  const stamp = shoppingScope
                    ? shoppingScopeInsertStamp(shoppingScope)
                    : { user_id: userId!, household_id: null as string | null };
                  const inserts = items.map((item) => ({
                    user_id: stamp.user_id,
                    household_id: stamp.household_id,
                    name: item.name,
                    amount: item.amount,
                    unit: item.unit,
                    category: item.category,
                    checked: item.checked,
                    source: item.source,
                  }));
                  // Clear existing items then insert new ones — scope-aware
                  let inlineDelQ = supabase.from("shopping_items").delete();
                  if (shoppingScope?.kind === "household") {
                    inlineDelQ = inlineDelQ.eq("household_id", shoppingScope.householdId);
                  } else {
                    inlineDelQ = inlineDelQ.eq("user_id", userId!).is("household_id", null);
                  }
                  const { error: delErr } = await inlineDelQ;
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
