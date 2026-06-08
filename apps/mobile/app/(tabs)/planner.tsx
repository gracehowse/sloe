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
  ActionSheetIOS,
  Platform,
  Image,
  Modal,
  FlatList,
  InteractionManager,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useAuth } from "@/context/auth";
import { useDiscoverRecipes, useSavedLibraryRecipes } from "@/lib/recipes";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { MacroIconRow } from "@/components/nutrition/MacroIconRow";
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
  RotateCw,
  Settings2,
  Sliders,
  Sun,
  Upload,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { Accent, Elevation, MacroColors, SlotColors, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useEntranceAnimation } from "@/hooks/useEntranceAnimation";
import ReAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { SPRING_DEFAULT, SPRING_SNAPPY } from "@/lib/motion";
import { useCardElevation } from "@/hooks/useCardElevation";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets } from "@/lib/calcTargets";
import { SkeletonCard } from "@/components/ui/SkeletonRow";
import {
  generateSmartPlan,
  ALL_MEAL_SLOTS,
  DEFAULT_PLANNER_BANDS,
  PORTION_MULTIPLIER_CLAMP,
  refitDayMealsToTargets,
  scaleMacros,
  slotMacroTargets,
  recipeSlotFitScore,
  type PlannerTargets,
} from "@/lib/mealPlanAlgo";
import { isMealPlanPlaceholderLikeTitle } from "@suppr/shared/nutrition/portionMultiplier";
import { shouldShowRecipeRemovedBadge } from "@suppr/shared/nutrition/recipeRemovedBadge";
import { coerceMacrosWhenCaloriesButNoGrams } from "@suppr/shared/nutrition/coerceRecipeMacrosForPlanning";
import {
  findPlanDayIdForCalendarDate,
  planCalendarDateForIndex,
  startDateForOffset,
  stripMidnight,
} from "@suppr/shared/mealPlan/planCalendarAnchor";
import { countChangedMealsInPlan } from "@suppr/shared/mealPlan/planDiff";
import { normalizeShoppingIngredientRow } from "@suppr/shared/planning/normalizeShoppingIngredientRow";
import {
  planWeekHeadlineTone,
  type PlanWeekHeadlineTone,
} from "@suppr/shared/planning/planWeekSummary";
import { formatPlannedMealKcalMacrosLine } from "@suppr/shared/nutrition/plannedMealDisplay";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";
import {
  enrichPlanMealsFiber,
  planMealFiberG,
  resolveRecipeFiberG,
  type RecipeFiberRef,
} from "@/lib/planMealFiber";
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
import { isFeatureEnabled, track } from "@/lib/analytics";
import * as Haptics from "expo-haptics";
import { HouseholdSummaryRow } from "@/components/HouseholdSummaryRow";
import { PlanEmptyState } from "@/components/PlanEmptyState";
import { PlanSourceSelector } from "@/components/plan/PlanSourceSelector";
import { PlanDayMacroSummary } from "@/components/plan/PlanDayMacroSummary";
import {
  type PlanSourceMode,
  DEFAULT_PLAN_SOURCE_MODE,
  selectPlanPool,
  canGenerateFromSource,
} from "@suppr/shared/planning/planSource";
import { MoveMealSheet } from "@/components/MoveMealSheet";
import { PlanTemplatesSheet } from "@/components/PlanTemplatesSheet";
import { useMealPlanSlots } from "@/hooks/use-meal-plan-slots";
import { PlanTabChrome } from "@/components/tabs/PlanTabChrome";
import { Layout } from "@/constants/layout";
import { consumePendingImportDayPlan } from "@/lib/planImportPendingApply";

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

/** Compact chip label so four slots fit one row on narrow phones. */
function compactPlanSlotLabel(slot: string): string {
  switch (slot) {
    case "Breakfast":
      return "Bfast";
    case "Lunch":
      return "Lunch";
    case "Dinner":
      return "Dinner";
    case "Snacks":
      return "Snack";
    default:
      return slot;
  }
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
function enrichPlanDaysFiber(days: DayPlan[], pool: RecipeFiberRef[]): DayPlan[] {
  if (pool.length === 0) return days;
  return days.map((dp) => ({
    ...dp,
    meals: enrichPlanMealsFiber(dp.meals, pool),
  }));
}

async function fetchPlanTargetsFromProfile(userId: string): Promise<{
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}> {
  let resolved = {
    calories: NUTRITION_DEFAULTS.calories,
    protein: NUTRITION_DEFAULTS.protein,
    carbs: NUTRITION_DEFAULTS.carbs,
    fat: NUTRITION_DEFAULTS.fat,
    fiber: NUTRITION_DEFAULTS.fiber,
  };
  const { data } = await supabase
    .from("profiles")
    .select(
      "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace",
    )
    .eq("id", userId)
    .single();
  if (data) {
    const d = data as Record<string, unknown>;
    const t = resolveTargets(
      {
        target_calories: d.target_calories as number | null,
        target_protein: d.target_protein as number | null,
        target_carbs: d.target_carbs as number | null,
        target_fat: d.target_fat as number | null,
        target_fiber_g: d.target_fiber_g as number | null,
      },
      {
        weight_kg: d.weight_kg as number | null,
        height_cm: d.height_cm as number | null,
        sex: d.sex as string | null,
        activity_level: d.activity_level as string | null,
        goal: d.goal as string | null,
        dob: d.dob as string | null,
        age: d.age != null ? Number(d.age) : null,
        plan_pace: d.plan_pace as string | null,
      },
    );
    resolved = { calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, fiber: t.fiber };
  }
  return resolved;
}

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
  // Secondary accent (Frost flag → damson, else clay) for the today-card edge,
  // generate/regenerate CTAs, refresh affordance, active controls, and link
  // actions. Threaded into the memoised StyleSheet via the dep array below.
  // Macros keep `MacroColors`; slots keep `SlotColors`; win keeps `Accent.win`;
  // status keeps success/warning/destructive.
  const accent = useAccent();

  const { recipes: discoverRecipes, loading: discoverLoading } = useDiscoverRecipes();
  const { recipes: savedRecipes, loading: savedLoading } = useSavedLibraryRecipes(userId);
  // ENG-766 — the recipe library hydrates AFTER the plan; gate the
  // "Recipe removed" badge on it being loaded so rows don't flash the
  // removed state (+ imageless cards) during that window.
  const recipeLibraryLoaded = !discoverLoading && !savedLoading;

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

  // ENG-790 — count of discover recipes the user hasn't already saved
  // (the "Discovery" pool size). De-duped against the library so the
  // count badge + generate gate match `selectPlanPool`'s combined math.
  const discoverCount = useMemo(() => {
    const savedIds = new Set(savedRecipes.map((r) => r.id));
    return discoverRecipes.filter((r) => !savedIds.has(r.id)).length;
  }, [discoverRecipes, savedRecipes]);

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

  // ENG-742 (2026-05-26) — Plan Import is cut from the 2026-07-01 launch
  // build (not launch-ready; Grace wants more testing without blocking
  // launch). Gate every entry point on the `plan_import_enabled` flag,
  // default-off (absent flag → false → hidden). Force-enable for testing
  // via PostHog targeting (TestFlight) or `EXPO_PUBLIC_FLAG_FORCE_PLAN_IMPORT_ENABLED=true`
  // in the sim. The screen + API routes stay alive behind the flag.
  const planImportEnabled = isFeatureEnabled("plan_import_enabled");

  // ENG-788 (2026-05-30) — Grace: "I dont know what happened here but it
  // looks terrible." At 0 saved recipes the old empty state rendered the
  // full day/start/meal config form ending in a permanently-disabled
  // 40%-opacity Generate button — a dead end. Behind `plan_empty_state_v2`:
  // at 0 recipes show the calm `<PlanEmptyState>` with a solid ENABLED
  // "Browse recipe library" CTA (the config form is meaningless with
  // nothing to plan); at ≥1 recipe keep the form but lift the pills to the
  // primary accent (web parity — `MealPlanner.tsx` uses `border-primary
  // bg-primary/10 text-primary`). Flag OFF → legacy path unchanged below.
  // Override in sim via `EXPO_PUBLIC_FLAG_FORCE_PLAN_EMPTY_STATE_V2=true`.
  const planEmptyStateV2 = isFeatureEnabled("plan_empty_state_v2");

  // ENG-790 (2026-05-31) — Grace: "give them the option to generate from the
  // discovery pool … we should probably always give these options — plan from
  // library only, library & discovery, only discovery." A three-way source
  // selector at the top of the plan form lets the user choose where generated
  // recipes are drawn from. This SUPERSEDES `plan_empty_state_v2`: the calm
  // empty state is no longer the whole 0-saved screen — instead "Discovery
  // only" / "Library & discovery" stay generatable at 0 saves, and the
  // ENG-788 empty card becomes the "My library is empty" sub-case (shown only
  // when the user explicitly picks "My library" with nothing saved). Pool
  // building + the generate gate run off the shared
  // `@suppr/shared/planning/planSource` helper so web (`MealPlanner.tsx`) and
  // mobile can't silently diverge. Flag OFF → legacy planEmptyStateV2 path.
  // Override in sim via `EXPO_PUBLIC_FLAG_FORCE_PLAN_SOURCE_SELECTOR=true`.
  const planSourceSelector = isFeatureEnabled("plan_source_selector");
  // When EITHER the source selector or the v2 empty state is on, the
  // day/start/meal pills render in the primary accent (web parity).
  const primaryPills = planSourceSelector || planEmptyStateV2;

  const openPlanImport = useCallback(() => {
    router.push("/plan-import");
  }, [router]);
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
  // ENG-790 — where generated recipes are drawn from. Default to the
  // broadest pool (library + Suppr's picks) so generation always works,
  // even at 0 saves. Mirrors `DEFAULT_PLAN_SOURCE_MODE` (web parity).
  const [planSource, setPlanSource] =
    useState<PlanSourceMode>(DEFAULT_PLAN_SOURCE_MODE);
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
  const [planTargets, setPlanTargets] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  } | null>(null);
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

  const recipeFiberPool = useMemo((): RecipeFiberRef[] => {
    const seen = new Set<string>();
    const out: RecipeFiberRef[] = [];
    for (const r of [...savedRecipes, ...discoverRecipes]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({
        id: r.id,
        title: r.title,
        calories: r.calories,
        fiberG: resolveRecipeFiberG(r as RecipeFiberRef),
      });
    }
    return out;
  }, [savedRecipes, discoverRecipes]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setPlanTargets(null);
        return;
      }
      let cancelled = false;
      void fetchPlanTargetsFromProfile(userId).then((t) => {
        if (!cancelled) setPlanTargets(t);
      });
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  // Batch 3.10 — plan templates state.
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  /** When a plan exists: expand to change day count / slots / start before regenerating. */
  const [planSetupExpanded, setPlanSetupExpanded] = useState(false);
  // 2026-05-23 — Plan setup rework. Replaces the three-section inline
  // setup card with two tappable chips + a ghost Regenerate link.
  // Tapping a chip opens a focused bottom sheet (one decision at a
  // time). HTML prototype: /tmp/suppr-prototypes/plan-chip-variants.html
  // (variant B).
  const [chipSheet, setChipSheet] = useState<"lengthStart" | "meals" | null>(null);
  // 2026-05-23 — Plan-row action sheet. Replaces the iOS fat-pill
  // `Alert.alert` action menu the [⋯] overflow used to launch. Same
  // actions (Log as planned, Change portion size, Move to different
  // meal, Remove from plan) but on an on-brand bottom sheet that
  // matches the rest of the app.
  const [rowMenu, setRowMenu] = useState<{ dayIdx: number; mealIndexInDay: number } | null>(null);
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
              ? "Couldn't reach Sloe. Check your connection and try again."
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

  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingImportDayPlan();
      if (!pending?.length) return;
      setPlan(pending as DayPlan[]);
      void persistPlan(pending as DayPlan[]);
      track(AnalyticsEvents.plan_template_applied, {
        dayCount: pending.length,
        slotCount: pending.reduce((n, d) => n + d.meals.length, 0),
        source: "plan_import",
      });
    }, [persistPlan, setPlan]),
  );

  const swapMeal = useCallback((dayIndex: number, mealIndex: number, slotName: string) => {
    const allPool = [...savedRecipes, ...discoverRecipes];
    // Audit L5 (2026-04-18): canonical slot via `normaliseMealSlot`
    // so "breakfast" / "Breakfast" / "BREAKFAST" all collapse to the
    // same branch. Unknown slots fall through to the snack ratio
    // (matches the prior default branch).
    const canonicalSlot = normaliseMealSlot(slotName) ?? "Snacks";
    const fits = allPool.filter((r) => {
      const tags = r.mealSlots ?? [];
      return tags.length === 0 || tags.some((t: string) => normaliseMealSlot(t) === canonicalSlot);
    });
    if (fits.length === 0) {
      Alert.alert("No alternatives", "Save more recipes to swap.");
      return;
    }

    const plannerTargets: PlannerTargets | null = planTargets
      ? {
          calories: planTargets.calories,
          protein: planTargets.protein,
          carbs: planTargets.carbs,
          fat: planTargets.fat,
          fiber: planTargets.fiber,
          calorieBandPct: DEFAULT_PLANNER_BANDS.calorieBandPct,
          carbFatBandPct: DEFAULT_PLANNER_BANDS.carbFatBandPct,
        }
      : null;
    const slotMacro = plannerTargets
      ? slotMacroTargets([canonicalSlot], plannerTargets)[0]!
      : { calories: 400, protein: 30, carbs: 45, fat: 15, fiber: 0 };
    const sorted = [...fits].sort(
      (a, b) => recipeSlotFitScore(a, slotMacro) - recipeSlotFitScore(b, slotMacro),
    );
    const slotTarget = slotMacro.calories;

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
          if (!picked || !plan || !plannerTargets) return;

          const currentDay = plan[dayIndex];
          if (!currentDay) return;

          const baseFromPool = (r: (typeof fits)[number]) => {
            const c = coerceMacrosWhenCaloriesButNoGrams({
              calories: r.calories,
              protein: r.protein,
              carbs: r.carbs,
              fat: r.fat,
              fiberG: (r as { fiberG?: number }).fiberG,
            });
            return {
              calories: c.calories,
              protein: c.protein,
              carbs: c.carbs,
              fat: c.fat,
              fiberG:
                c.fiberG ??
                (r as { fiber_g?: number }).fiber_g ??
                (r as { fiberG?: number }).fiberG ??
                0,
            };
          };

          const trialBase = currentDay.meals.map((m, mi) =>
            mi === mealIndex ? baseFromPool(picked) : (() => {
              const ref = allPool.find((r) => r.id === m.recipeId);
              if (ref) return baseFromPool(ref);
              return {
                calories: m.calories,
                protein: m.protein,
                carbs: m.carbs,
                fat: m.fat,
                fiberG: planMealFiberG(m, recipeFiberPool),
              };
            })(),
          );
          const trialFit = refitDayMealsToTargets({ recipes: trialBase, targets: plannerTargets });
          const trialDayCals = trialBase.reduce(
            (s, r, i) => s + r.calories * (trialFit.multipliers[i] ?? 1),
            0,
          );
          const dayTarget = plannerTargets.calories;

          const doSwap = () => {
            setPlan((prev) => {
              if (!prev) return prev;
              const next = prev.map((dp, di) => {
                if (di !== dayIndex) return dp;
                const baseRecipes = dp.meals.map((m, mi) =>
                  mi === mealIndex ? baseFromPool(picked) : (() => {
                    const ref = allPool.find((r) => r.id === m.recipeId);
                    if (ref) return baseFromPool(ref);
                    return {
                      calories: m.calories,
                      protein: m.protein,
                      carbs: m.carbs,
                      fat: m.fat,
                      fiberG: planMealFiberG(m, recipeFiberPool),
                    };
                  })(),
                );
                const fit = refitDayMealsToTargets({ recipes: baseRecipes, targets: plannerTargets });
                const newMeals = dp.meals.map((m, mi) => {
                  const scaled = scaleMacros(baseRecipes[mi]!, fit.multipliers[mi] ?? 1);
                  return {
                    ...m,
                    ...(mi === mealIndex
                      ? {
                          recipeTitle: picked.title,
                          recipeId: picked.id,
                          isPlaceholder: false,
                          leftoverOf: undefined,
                          isLeftover: undefined,
                        }
                      : {}),
                    calories: scaled.calories,
                    protein: scaled.protein,
                    carbs: scaled.carbs,
                    fat: scaled.fat,
                    fiberG: scaled.fiberG,
                    portionMultiplier: undefined,
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
                return {
                  ...dp,
                  meals: newMeals,
                  totals,
                  ...(fit.residualProteinGap < 0 ? { residualProteinGap: fit.residualProteinGap } : {}),
                };
              });
              void persistPlan(next);
              return next;
            });
          };

          if (trialDayCals > dayTarget * 1.1) {
            Alert.alert(
              "Over calorie target",
              `After re-fitting portions, this day is about ${Math.round(trialDayCals).toLocaleString()} kcal (target: ${dayTarget.toLocaleString()}).`,
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
  }, [savedRecipes, discoverRecipes, plan, planTargets, persistPlan, recipeFiberPool]);

  // ENG-820 (Plan win-moment, Redesign — Design Direction 2026): one flag gates
  // the whole Plan win layer — the state-aware headline tone + pulse, the 7/7
  // success haptic, and the generate/move settle haptics. Flag OFF preserves
  // today's flat headline + silent commits. Declared here (before the move
  // handler) so callers below can read it without a TDZ hazard.
  const winMomentsEnabled = isFeatureEnabled("redesign_winmoment");

  // ENG-795 / Phase-2 card sweep — soft resting-card elevation. Behind
  // `design_system_elevation` the summary card picks up the soft ambient
  // shadow + drops its hairline border; flag-off keeps today's flat
  // hairline-bordered card. Spread onto the card View below.
  const cardElevation = useCardElevation();

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
        // ENG-820 — settle haptic so a moved meal landing in its new slot is
        // felt. Behind `redesign_winmoment`; flag-off keeps the silent move.
        if (winMomentsEnabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        // Fire-and-forget persist; UI already reflects the move.
        void persistPlan(next);
        return next;
      });
    },
    [persistPlan, winMomentsEnabled],
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

  // ENG-820 — make the "Hits your targets N of 7" headline state-aware. Behind
  // `redesign_winmoment` (resolved above as `winMomentsEnabled`) the headline is
  // coloured by its tone (win = the reserved win token, progress = amber, calm =
  // muted) and the win landmark fires a quiet success haptic + a one-shot scale
  // pulse. Flag OFF keeps today's flat `colors.text` headline.
  const summaryTone = useMemo(
    () => planWeekHeadlineTone(summaryScore),
    [summaryScore],
  );
  const summaryTitleColor = useMemo(() => {
    if (!winMomentsEnabled) return colors.text;
    if (summaryTone === "win") return Accent.win;
    if (summaryTone === "progress") return Accent.warning;
    return colors.textSecondary; // calm — informative, not alarming
  }, [winMomentsEnabled, summaryTone, colors.text, colors.textSecondary]);

  // One-shot pulse + success haptic when the week first crosses to 7/7 (win).
  // Keyed on the tone identity so it fires on the rising edge into `win`, never
  // on every re-render. Inert when the win flag is off.
  const summaryPulse = useSharedValue(1);
  const prevSummaryToneRef = useRef<PlanWeekHeadlineTone | null>(null);
  useEffect(() => {
    const prev = prevSummaryToneRef.current;
    prevSummaryToneRef.current = summaryTone;
    if (!winMomentsEnabled) return;
    // Only celebrate the rising edge INTO win (prev was a real non-win tone),
    // so re-mounting an already-7/7 plan doesn't replay the pulse/haptic.
    if (summaryTone === "win" && prev !== null && prev !== "win") {
      summaryPulse.value = withSequence(
        withSpring(1.06, SPRING_SNAPPY),
        withSpring(1, SPRING_DEFAULT),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [winMomentsEnabled, summaryTone, summaryPulse]);
  const summaryTitleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: summaryPulse.value }],
  }));

  const portionMultiplierList = useMemo(() => plannerPortionMultiplierSteps(), []);

  // Determine progress bar color based on calorie percentage vs target
  const getProgressColor = (cals: number, target: number) => {
    if (target <= 0) return colors.border;
    const pct = (cals / target) * 100;
    if (pct > 105) return Accent.warning; // Over target — amber, never red
    if (pct >= 95 && pct <= 105) return Accent.success; // Within ±5%
    if (pct >= 50) return Accent.warning; // Under but getting there
    return colors.border; // Way under
  };

  const headerEntrance = useEntranceAnimation({ delay: 0 });
  const summaryEntrance = useEntranceAnimation({ delay: 80 });
  const planEntrance = useEntranceAnimation({ delay: 160 });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: {
          paddingHorizontal: Layout.planScreenPaddingX,
          paddingTop: Spacing.sm,
          paddingBottom: Layout.screenPaddingBottom,
          gap: Layout.planScrollGap,
        },
        // Prototype port — uppercase micro-overline above the big title.
        headerOverline: {
          ...Type.label,
          color: colors.textTertiary,
          letterSpacing: 1.2,
        },
        headerTitle: {
          ...Type.title,
          color: colors.text,
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
        // (accent.primary + "14") because expo-linear-gradient isn't
        // installed; switching to a true gradient only requires wrapping
        // the inner content in <LinearGradient> with the same two colours
        // the prototype uses (primary 12% → fat 8%).
        // Sloe DS — calm cream slab: warm card fill, soft xl radius, roomy
        // padding. The state-aware serif headline + diagnosis subtitle sit
        // on the cream with breathing room above the action row.
        summaryCard: {
          backgroundColor: colors.card,
          borderRadius: Radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          marginBottom: Spacing.xs,
        },
        summaryOverline: {
          ...Type.label,
          color: colors.textTertiary,
          letterSpacing: 1.2,
          marginBottom: Spacing.xs,
        },
        summaryTitle: {
          ...Type.headline,
          fontSize: 20,
          // colour is applied at the call-site via `summaryTitleColor`
          // (ENG-820 state-aware tone behind `redesign_winmoment`; flag-off
          // resolves back to `colors.text`).
          marginBottom: Spacing.xs,
        },
        summarySubtitle: {
          ...Type.caption,
          fontSize: 12,
          color: colors.textSecondary,
          lineHeight: 18,
          marginBottom: Spacing.lg,
        },
        summaryActions: { flexDirection: "row", gap: Spacing.sm },
        summaryPrimaryBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: accent.primary,
          paddingHorizontal: Spacing.md,
          paddingVertical: 10,
          borderRadius: Radius.lg,
        },
        summaryPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
        summarySecondaryBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: Spacing.md,
          paddingVertical: 10,
          borderRadius: Radius.lg,
        },
        summarySecondaryText: { color: colors.text, fontSize: 13, fontWeight: "600" },

        // Sloe DS — filter chip row (plan length+start / meals). Calm cream
        // chips with a hairline border + soft radius replace the flat grey
        // `colors.border` fill so the row reads as quiet, tappable settings.
        filterRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          marginBottom: Spacing.md,
        },
        filterChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        filterChipText: { fontSize: 12.5, fontWeight: "600", color: colors.text },

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
        dayCardToday: { borderColor: accent.primary, backgroundColor: accent.primary + "08" },
        dayCardName: { fontSize: 13, fontWeight: "600", color: colors.text },
        dayCardNameToday: { color: accent.primary },
        dayCardMeals: { gap: 2 },
        dayCardMeal: { fontSize: 10, color: colors.textTertiary, lineHeight: 12 },
        dayCardProgressBar: { width: "100%", height: 3, backgroundColor: colors.border, borderRadius: 1.5, marginVertical: Spacing.xs },
        dayCardProgressFill: { height: 3, borderRadius: 1.5 },
        dayCardCalories: { fontSize: 10, color: colors.textTertiary, fontVariant: ["tabular-nums"] },

        sectionLabel: {
          ...Type.label,
          color: colors.textSecondary,
          marginTop: Spacing.sm,
          marginBottom: Spacing.sm,
        },

        // 2026-05-22 evening (Grace 3-C): Plan now reads as a flat
        // continuous list. Day sections separated by a hairline divider
        // at the top (suppressed on the first day) instead of each
        // day being its own bordered card. Section header has more
        // breathing room above the meals it introduces.
        daySection: {
          marginBottom: Layout.planDayGap,
          paddingTop: Spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        daySectionFirst: {
          borderTopWidth: 0,
          paddingTop: 0,
        },
        daySectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: Spacing.sm,
          paddingHorizontal: 2,
        },
        // 2026-05-22 evening (Grace 3-C): strip per-day card chrome
        // so Plan reads as one continuous list with day section
        // headers (like Today) instead of seven distinct bordered
        // rectangles stacked. Day separation now comes from the
        // section header overline + a hairline divider between days.
        planDayCard: {
          backgroundColor: "transparent",
          borderRadius: 0,
          borderWidth: 0,
          borderColor: "transparent",
          overflow: "visible",
        },
        planDayCardMeta: {
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 6,
        },

        // Sloe DS — calm per-day empty slate. Two-line hierarchy (a quiet
        // statement + a soft next-step hint) with breathing room replaces the
        // single dense "No slots yet — add one or regenerate." line.
        dayEmptyState: {
          paddingTop: Spacing.sm,
          paddingBottom: Spacing.xs,
          paddingHorizontal: Spacing.sm,
          gap: 2,
        },
        dayEmptyText: {
          ...Type.body,
          fontSize: 13,
          color: colors.textSecondary,
        },
        dayEmptyHint: {
          ...Type.caption,
          fontSize: 12,
          color: colors.textTertiary,
          lineHeight: 16,
        },

        // Sloe DS — empty/setup cream slab. Soft xl radius + roomy padding so
        // the "Plan your week" form reads as a calm card, not a dense panel.
        card: {
          backgroundColor: colors.card,
          borderRadius: Radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          gap: Spacing.md,
        },
        cardTitle: { ...Type.headline, fontSize: 20, color: colors.text },
        cardDesc: { ...Type.body, color: colors.textSecondary, lineHeight: 20 },

        // ENG-790 — "My library is empty" sub-case + disabled-source hint.
        libraryEmptyHint: {
          marginTop: Spacing.md,
          padding: Spacing.md,
          borderRadius: Radius.md,
          backgroundColor: colors.border + "40",
        },
        libraryEmptyHintText: {
          ...Type.body,
          color: colors.textSecondary,
          lineHeight: 20,
        },
        generateHint: {
          ...Type.caption,
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: Spacing.sm,
        },

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
        dayBtnActive: {
          borderColor: colors.textSecondary,
          backgroundColor: colors.textSecondary + "18",
        },
        dayBtnText: { color: colors.textTertiary, fontWeight: "600", fontSize: 14 },
        dayBtnTextActive: { color: colors.text, fontWeight: "700" },
        // ENG-788 (2026-05-30) — primary-accent selected pill for the
        // `plan_empty_state_v2` / `plan_source_selector` config form. Web
        // parity: `MealPlanner.tsx` selected segments use
        // `border-primary bg-primary/10 text-foreground`.
        // `colors.tint` is the theme-correct primary (accent.primary light /
        // primaryLight dark); `+ "1A"` ≈ 10% alpha = web `bg-primary/10`.
        // Label is `colors.text` (foreground), NOT `colors.tint`: tint text on
        // a 10% tint fill measures 2.89:1, below WCAG AA — matches the
        // canonical LogSheet slot pill (`text-foreground` on `bg-primary/10`).
        dayBtnActivePrimary: {
          borderColor: colors.tint,
          backgroundColor: colors.tint + "1A",
        },
        dayBtnTextActivePrimary: { color: colors.text, fontWeight: "700" },

        generateBtn: {
          backgroundColor: accent.primary,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: "center",
        },
        generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

        // Sloe DS — the weekday reads in Newsreader (serif, plum ink) so the
        // week scans as a calm editorial list of days, not a stack of bold
        // sans labels. Matches the "Meal plan" serif tab header.
        dayTitle: { ...Type.headline, fontSize: 18, color: colors.text },
        // Prototype port (2026-04-20) — small uppercase "TODAY" pill
        // next to the weekday label. Primary-color text, no pill
        // background — matches prototype `screens-mobile.jsx:482`.
        dayTodayPill: {
          fontSize: 10,
          fontWeight: "700",
          color: colors.textSecondary,
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

        // 2026-05-22 evening (Grace): tightened vertical padding 10→8
        // so 4 meals × 7 days fits closer to 2 screens not 3.
        mealRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderTopWidth: 1,
          borderTopColor: colors.border + "99",
          gap: Spacing.sm,
        },
        /** Single-row add-slot chips — kept tight so empty/partial days
         *  don't balloon card height (Grace TF, 2026-05-21). */
        addSlotBar: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        addSlotLabel: {
          fontSize: 11,
          fontWeight: "600",
          color: colors.textTertiary,
          letterSpacing: 0.3,
        },
        addSlotRow: {
          flex: 1,
          flexDirection: "row",
          gap: 6,
          minWidth: 0,
        },
        addSlotChip: {
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          paddingVertical: 8,
          paddingHorizontal: 4,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        addSlotChipText: {
          fontSize: 11,
          fontWeight: "600",
          color: colors.textSecondary,
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
        mealSlot: { ...Type.label, letterSpacing: 0.8 },
        mealTitle: {
          ...Type.body,
          fontSize: 14,
          fontWeight: "600",
          color: colors.text,
          marginTop: 2,
          lineHeight: 19,
        },
        mealMacros: {
          ...Type.caption,
          fontSize: 11,
          color: colors.textSecondary,
          marginTop: 2,
          fontVariant: ["tabular-nums"],
        },
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
        // accent.primary text screamed for attention with 2-4 of these
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
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 4,
        },
        mealLogBtnText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
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
        shoppingListTitle: { ...Type.headline, fontSize: 16, color: colors.text },
        shoppingListSubtitle: { ...Type.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },

        actionsRow: { gap: Spacing.md },
        regenBtn: {
          borderWidth: 1,
          borderColor: accent.primary + "50",
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: "center",
        },
        regenBtnText: { color: accent.primary, fontWeight: "700", fontSize: 15 },
      }),
    [colors, accent],
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
          "id, day, start_date, meals:meal_plan_meals(plan_day_id, slot_index, name, recipe_title, recipe_id, calories, protein, carbs, fat, portion_multiplier, is_placeholder)",
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
                recipeId: (m.recipe_id as string) ?? undefined,
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
        setPlan(enrichPlanDaysFiber(plans, recipeFiberPool));
        return;
      }

      // Schema refactor Phase 3 (2026-05-11) — legacy `meal_plans`
      // JSONB fallback removed (table dropped 2026-04-21). Plans come
      // exclusively from `meal_plan_days` + `meal_plan_meals` above.
    })();
    return () => { cancelled = true; };
  }, [userId, recipeFiberPool]);

  // When the recipe library hydrates after the plan, backfill fibre on rows
  // (meal_plan_meals does not persist fibre; we derive from linked recipes).
  useEffect(() => {
    if (!plan?.length || recipeFiberPool.length === 0) return;
    setPlan((prev) => {
      if (!prev?.length) return prev;
      const enriched = enrichPlanDaysFiber(prev, recipeFiberPool);
      const changed = enriched.some((dp, di) =>
        dp.meals.some((m, mi) => (m.fiberG ?? 0) !== (prev[di]?.meals[mi]?.fiberG ?? 0)),
      );
      return changed ? enriched : prev;
    });
  }, [recipeFiberPool, plan?.length]);

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
      const resolved = userId
        ? await fetchPlanTargetsFromProfile(userId)
        : {
            calories: NUTRITION_DEFAULTS.calories,
            protein: NUTRITION_DEFAULTS.protein,
            carbs: NUTRITION_DEFAULTS.carbs,
            fat: NUTRITION_DEFAULTS.fat,
            fiber: NUTRITION_DEFAULTS.fiber,
          };

      const targets: PlannerTargets = {
        calories: resolved.calories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fat: resolved.fat,
        fiber: resolved.fiber,
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
            fiberG: c.fiberG ?? (r as { fiber_g?: number }).fiber_g ?? (r as { fiberG?: number }).fiberG ?? 0,
            mealType: (r as { mealSlots?: string[] | null }).mealSlots ?? null,
          };
        });
      const fullPool = [...savedPool, ...discoverPool];
      // ENG-790: when the source selector is on, draw the pool from the
      // user's chosen source (library / library+discovery / discovery) via
      // the shared helper. Legacy path (flag off) keeps the saved-first,
      // fill-from-discover heuristic. `discoverPool` is already de-duped
      // against `savedPool`, so `selectPlanPool`'s own de-dupe is a no-op.
      const recipePool = planSourceSelector
        ? selectPlanPool(planSource, { library: savedPool, discover: discoverPool })
        : savedPool.length >= 6
          ? savedPool
          : fullPool;

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

      setPlan(enrichPlanDaysFiber(newPlan, recipeFiberPool));
      setPlanTargets(resolved);

      // ENG-820 — plan-generate is one of the most consequential Plan commits;
      // give it a settle haptic so the week landing is felt, not silent. The
      // reserved loud success haptic stays with the 7/7 headline win-moment, so
      // this is a Medium *impact* settle. Behind `redesign_winmoment`; flag-off
      // keeps the silent generate.
      if (winMomentsEnabled) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

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
  }, [savedRecipes, discoverRecipes, days, userId, enabledSlots, recipeFiberPool, planSourceSelector, planSource, winMomentsEnabled]);

  const openGenerateMenu = useCallback(() => {
    if (generating) return;
    // ENG-742 — when Plan Import is cut from launch the menu has only one
    // real action, so skip it and run the library generator directly.
    if (!planImportEnabled) {
      void generatePlan();
      return;
    }
    const labels = ["Generate from library", "Import existing plan", "Cancel"] as const;
    const runLibrary = () => {
      void generatePlan();
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Generate",
          options: [...labels],
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) runLibrary();
          else if (idx === 1) openPlanImport();
        },
      );
      return;
    }
    Alert.alert("Generate", undefined, [
      { text: "Generate from library", onPress: runLibrary },
      { text: "Import existing plan", onPress: openPlanImport },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [generating, generatePlan, openPlanImport, planImportEnabled]);

  // ENG-790 — generate gate. With the source selector on, generation is
  // gated by the chosen source's pool (Discovery/Library&discovery stay
  // generatable at 0 saves); flag off keeps the legacy 0-saved gate.
  const generateDisabled = planSourceSelector
    ? !canGenerateFromSource(planSource, {
        libraryCount: savedRecipes.length,
        discoverCount,
      })
    : savedRecipes.length === 0;
  // The "My library is empty" sub-case: the ENG-788 calm empty state,
  // now folded UNDER the selector (not the whole screen) so the user
  // keeps the discovery escape hatch above it.
  const libraryEmptySubcase =
    planSourceSelector && planSource === "library" && savedRecipes.length === 0;

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
            borderColor: accent.primary + "40",
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
              backgroundColor: accent.primary + "1A",
            }}
          >
            <RefreshCw size={14} color={accent.primary} strokeWidth={2.25} />
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
        trailing={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {planImportEnabled && (
              <Pressable
                style={styles.headerIconBtn}
                onPress={openPlanImport}
                accessibilityRole="button"
                accessibilityLabel="Import existing meal plan"
                accessibilityHint="Paste a meal plan or program to import recipes and schedule"
                testID="plan-header-import"
              >
                <Upload size={18} color={colors.text} strokeWidth={1.75} />
              </Pressable>
            )}
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
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ReAnimated.View style={headerEntrance.style}>
        {/* Named plan slots switcher — pre-2026-05-22 this rendered
            unconditionally, which on a single-plan setup put a "This
            week" pill right under the "This week" sub-tab and a
            redundant "+ New" affordance with no obvious purpose.
            Grace 2026-05-22: "drop the redundant This week pill row".
            Gate behind >1 plan slot so multi-plan users keep the
            switcher; single-plan users see a cleaner Plan tab.
            Creating a new plan slot moves through Settings → Plan
            slots when only one plan exists. */}
        {planSlots.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 6, paddingRight: 4 }}
          style={{ marginBottom: Spacing.sm }}
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
                  borderColor: active ? colors.textSecondary : colors.border,
                  backgroundColor: active ? colors.textSecondary + "18" : colors.card,
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Plan: ${s.name}${active ? ", active" : ""}. Long-press to rename or delete.`}
              >
                {active ? (
                  <Check size={11} color={colors.text} strokeWidth={1.75} />
                ) : null}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: active ? "700" : "500",
                    color: active ? colors.text : colors.textSecondary,
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
        ) : null}
        </ReAnimated.View>

        <ReAnimated.View style={summaryEntrance.style}>
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
          <View
            style={[
              styles.summaryCard,
              cardElevation.shadowStyle,
              { borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0 },
              cardElevation.liftBg ? { backgroundColor: cardElevation.liftBg } : null,
            ]}
            testID="plan-summary-card"
          >
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
            {/* ENG-820 — state-aware headline. `summaryTitleColor` resolves to
                the win/progress/calm tone behind `redesign_winmoment`, else
                today's flat `colors.text`. The pulse fires once on the rising
                edge into 7/7. testID lets the parity test pin the colour. */}
            <ReAnimated.Text
              testID="plan-summary-headline"
              style={[styles.summaryTitle, { color: summaryTitleColor }, summaryTitleAnimStyle]}
            >
              {`Hits your targets ${summaryScore.hits} of ${summaryScore.total} day${summaryScore.total === 1 ? "" : "s"}`}
            </ReAnimated.Text>
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
                onPress={openGenerateMenu}
                disabled={generating}
                accessibilityRole="button"
                accessibilityLabel="Generate or import plan"
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <RefreshCw size={14} color="#fff" strokeWidth={1.75} />
                    <Text style={styles.summaryPrimaryText}>Generate ▾</Text>
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
        </ReAnimated.View>

        <ReAnimated.View style={planEntrance.style}>
        {/* 2026-05-23 — Plan setup chip row (variant B).
            Replaces the three-section inline setup card. Two borderless
            tinted chips condense plan length+start and meal-toggle
            settings; tapping a chip opens a focused bottom sheet.
            Regenerate moves to a ghost text-link on the right so it
            doesn't compete visually with the primary FAB. Day cards
            stay primary on first scroll instead of being pushed below
            a settings form. HTML prototype:
            `/tmp/suppr-prototypes/plan-chip-variants.html` (B). */}
        {plan && plan.length > 0 ? (() => {
          const startLabelForChip =
            startOffset === 0 ? "Today" : startOffset === 1 ? "Tomorrow" : "Next week";
          const lengthStartLabel = `${days} day${days > 1 ? "s" : ""} · ${startLabelForChip}`;
          const enabledList = ALL_MEAL_SLOTS.filter((s) => enabledSlots.has(s));
          const SHORT: Record<string, string> = {
            Breakfast: "Brk",
            Lunch: "Lun",
            Dinner: "Din",
            Snacks: "Snk",
          };
          const mealsLabel =
            enabledList.length === ALL_MEAL_SLOTS.length
              ? "All meals"
              : enabledList.length === 0
              ? "No meals"
              : enabledList.map((s) => SHORT[s] ?? s).join(" · ");
          return (
            <View style={styles.filterRow}>
              <Pressable
                testID="plan-chip-length-start"
                accessibilityRole="button"
                accessibilityLabel={`Plan length and start: ${lengthStartLabel}`}
                onPress={() => setChipSheet("lengthStart")}
                style={styles.filterChip}
              >
                <Text style={styles.filterChipText}>
                  {lengthStartLabel}
                </Text>
                <ChevronDown size={11} color={colors.textTertiary} strokeWidth={2} />
              </Pressable>
              <Pressable
                testID="plan-chip-meals"
                accessibilityRole="button"
                accessibilityLabel={`Meals: ${mealsLabel}`}
                onPress={() => setChipSheet("meals")}
                style={styles.filterChip}
              >
                <Text style={styles.filterChipText}>
                  {mealsLabel}
                </Text>
                <ChevronDown size={11} color={colors.textTertiary} strokeWidth={2} />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable
                testID="plan-generate-menu"
                accessibilityRole="button"
                accessibilityLabel="Generate plan menu"
                onPress={openGenerateMenu}
                disabled={generating}
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  opacity: generating ? 0.5 : 1,
                }}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={accent.primary} />
                ) : (
                  <ChevronDown size={13} color={accent.primary} strokeWidth={2.25} />
                )}
                <Text style={{ fontSize: 13, fontWeight: "600", color: accent.primary }}>
                  Generate ▾
                </Text>
              </Pressable>
            </View>
          );
        })() : null}

        {/* Generate controls */}
        {!plan && (!planSourceSelector && planEmptyStateV2 && savedRecipes.length === 0 ? (
          /* ENG-788 (legacy path, flag off) — calm empty state. With
             nothing saved there is nothing to plan, so the day/start/meal
             config form was just noise ending in a dead disabled button.
             Send the user to the one action that unblocks them: build a
             library. Under `plan_source_selector` this is superseded: the
             form always renders with the source selector on top, and this
             empty treatment is folded in as the `libraryEmptySubcase`. */
          <PlanEmptyState
            onBrowseLibrary={() => router.push("/(tabs)/library" as Href)}
            planImportEnabled={planImportEnabled}
            onImport={openPlanImport}
          />
        ) : (
          <View style={styles.card}>
            {/* DC12 (2026-05-14, premium-bar audit) — low-emotion
                empty state. Linear/direct copy: tells the user what
                they're looking at (no plan yet) and what to do
                (generate one), with the 30-second time signal that
                a returning MFP/Lose It refugee will instantly read
                as "this won't be a 10-minute chore". Web parity:
                `src/app/components/PlannerScreen.tsx`. */}
            <Text style={styles.cardTitle}>
              {primaryPills ? "Plan your week" : "No plan yet"}
            </Text>
            <Text style={styles.cardDesc}>
              {planSourceSelector ? (
                <>Pick where your recipes come from, then generate a balanced week.</>
              ) : planEmptyStateV2 ? (
                <>
                  {savedRecipes.length} recipe{savedRecipes.length !== 1 ? "s" : ""} in your library — Sloe balances them to your targets.
                </>
              ) : (
                <>
                  Generate one in 30 seconds. {savedRecipes.length} recipe{savedRecipes.length !== 1 ? "s" : ""} in your library.
                  {savedRecipes.length === 0 ? " Save some from Discover first." : ""}
                </>
              )}
            </Text>
            {!primaryPills && (
              <Pressable
                onPress={() => router.push("/(tabs)/library" as Href)}
                accessibilityRole="button"
                accessibilityLabel="Open recipe library"
                style={{ alignSelf: "flex-start", marginTop: Spacing.sm, marginBottom: Spacing.xs }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary }}>
                  Open recipe library
                </Text>
              </Pressable>
            )}

            {/* ENG-790 — source selector. Drives where generated recipes
                come from; default "Library & discovery" so generation
                always works even at 0 saves (the discovery escape hatch
                that retires the ENG-788 dead-end). */}
            {planSourceSelector && (
              <PlanSourceSelector
                mode={planSource}
                onChange={setPlanSource}
                libraryCount={savedRecipes.length}
                discoverCount={discoverCount}
              />
            )}

            {libraryEmptySubcase ? (
              /* "My library is empty" sub-case — folded UNDER the selector
                 (ENG-788 treatment, no longer the whole screen). The pills
                 + generate are hidden because there is nothing in the
                 library to plan; the selector above is the escape hatch
                 (switch to Library & discovery / Discovery only). */
              <View style={styles.libraryEmptyHint}>
                <Text style={styles.libraryEmptyHintText}>
                  Your library is empty. Save a recipe to plan from it — or pick
                  {" "}<Text style={{ fontWeight: "700", color: colors.tint }}>Library &amp; discovery</Text> above to generate from Sloe&apos;s picks now.
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/library" as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="Browse recipe library"
                  style={{ alignSelf: "flex-start", marginTop: Spacing.sm }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.tint }}>
                    Browse recipe library →
                  </Text>
                </Pressable>
              </View>
            ) : (
            <>
            <View style={styles.daysRow}>
              {([1, 3, 7] as const).map((d) => {
                const locked = isFree && d > 1;
                return (
                  <Pressable
                    key={d}
                    style={[styles.dayBtn, days === d && (primaryPills ? styles.dayBtnActivePrimary : styles.dayBtnActive), locked && { opacity: 0.5 }]}
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
                      <Text style={[styles.dayBtnText, days === d && (primaryPills ? styles.dayBtnTextActivePrimary : styles.dayBtnTextActive)]}>
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
                  style={[styles.dayBtn, startOffset === o.val && (primaryPills ? styles.dayBtnActivePrimary : styles.dayBtnActive)]}
                  onPress={() => setStartOffset(o.val)}
                >
                  <Text style={[styles.dayBtnText, startOffset === o.val && (primaryPills ? styles.dayBtnTextActivePrimary : styles.dayBtnTextActive)]}>
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
                    style={[styles.dayBtn, active && (primaryPills ? styles.dayBtnActivePrimary : styles.dayBtnActive)]}
                    onPress={() => toggleSlot(slot)}
                  >
                    {active ? (
                      <CheckCircle2
                        size={14}
                        color={primaryPills ? colors.tint : "#fff"}
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
                    <Text style={[styles.dayBtnText, active && (primaryPills ? styles.dayBtnTextActivePrimary : styles.dayBtnTextActive)]}>
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            </>
            )}

            {!libraryEmptySubcase && (
            <Pressable
              style={[styles.generateBtn, generateDisabled && { opacity: 0.4 }]}
              onPress={generatePlan}
              disabled={generating || generateDisabled}
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
            )}
            {planSourceSelector && generateDisabled && !libraryEmptySubcase && (
              <Text style={styles.generateHint}>
                No recipes available to plan from right now.
              </Text>
            )}
            {planImportEnabled && (
              <Pressable
                onPress={openPlanImport}
                accessibilityRole="button"
                accessibilityLabel="Import existing meal plan"
                style={{ alignItems: "center", marginTop: Spacing.md, paddingVertical: Spacing.sm }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: accent.primary }}>
                  Import existing plan
                </Text>
              </Pressable>
            )}
          </View>
        ))}

        {/* 2026-05-23 — removed "YOUR 7-DAY PLAN" uppercase overline +
            "Browse library" outline pill. The "This week" sub-tab
            above already labels the section; the day-cards below speak
            for themselves. The overline + pill read as a third competing
            header. Browse library lives in the bottom + log sheet for
            users who want to add a recipe to the plan. */}

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
          <View style={{ position: "relative", gap: Layout.planDayGap }}>
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
          <View key={dp.day} style={styles.daySection}>
            <View style={styles.daySectionHeader}>
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
            {/* Calm Sloe macro summary — four evenly-spread cells with a
                clear two-line hierarchy (macro grams over an "On track" /
                ±gap caption) replace the old jammed inline run. Computed
                here, rendered by `PlanDayMacroSummary`. */}
            {planTargets ? (() => {
              const dayFiber =
                Math.round(
                  dp.meals.reduce((s, m) => s + planMealFiberG(m, recipeFiberPool), 0) * 10,
                ) / 10;
              return (
                <PlanDayMacroSummary
                  cells={[
                    { label: "P", value: dp.totals.protein, target: planTargets.protein, color: MacroColors.protein },
                    { label: "C", value: dp.totals.carbs, target: planTargets.carbs, color: MacroColors.carbs },
                    { label: "F", value: dp.totals.fat, target: planTargets.fat, color: MacroColors.fat },
                    { label: "Fi", value: dayFiber, target: planTargets.fiber, color: MacroColors.fiber },
                  ]}
                />
              );
            })() : null}
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

            <View style={styles.planDayCard}>
            {dp.meals.length === 0 ? (
              <View style={styles.dayEmptyState}>
                <Text style={styles.dayEmptyText}>
                  No meals planned for this day yet.
                </Text>
                <Text style={styles.dayEmptyHint}>
                  Add a slot below, or regenerate the week.
                </Text>
              </View>
            ) : null}
            {(() => {
              const sortedMeals = sortMealsBySlotOrder(dp.meals);
              return sortedMeals.map((meal) => {
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
                  // 2026-05-23 — all 3 row triggers (long-press, tap,
                  // overflow) now route to the same on-brand `rowMenu`
                  // bottom sheet. Long-press keeps its haptic since it
                  // was already the most-discoverable gesture for the
                  // action menu.
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setRowMenu({ dayIdx, mealIndexInDay });
                }}
                onPress={() => {
                  setRowMenu({ dayIdx, mealIndexInDay });
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
                  <Text
                    style={[
                      styles.mealSlot,
                      { color: SLOT_COLOR_MOBILE[resolvePlanSlotIconKey(meal.name)] },
                    ]}
                  >
                    {meal.name}
                  </Text>
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
                          backgroundColor: colors.backgroundSecondary,
                          borderWidth: 1,
                          borderColor: colors.border,
                          flexShrink: 0,
                        }}
                        accessibilityLabel={`${multLabel} times portion`}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: colors.textSecondary,
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
                  {/* 2026-05-22 evening (Grace): per-meal macros
                      removed from the inline Plan row to neaten the
                      surface — full macros live on tap-through to the
                      meal detail. Empty slot still shows the dash line
                      so users see the slot exists but isn't planned. */}
                  {planMealHasRecipe(meal) ? (
                    <Text style={styles.mealMacros} numberOfLines={1}>
                      {`${Math.round(meal.calories)} kcal`}
                    </Text>
                  ) : (
                    <Text style={styles.mealMacros} numberOfLines={1}>
                      Empty
                    </Text>
                  )}
                  {/* ENG-744 (2026-05-26, Grace) — removed the per-row
                      "Fits N%" / "Over by N kcal" chip. Per-meal fit %
                      was ambiguous (fits what?) and cumulative "over by"
                      on individual rows read oddly; the day header
                      ("1,225 / 901 kcal" + P/C/F/Fi deltas) carries the
                      useful signal. */}
                  {/* Recipe-wave (2026-05-10) — "Recipe removed" badge
                      for plan rows whose `recipeId` is set but no
                      longer resolves to any known recipe. Pre-fix the
                      card silently dropped to a no-image fallback,
                      reading as a broken default. Now the state is
                      explained so the user can swap or remove the
                      slot. Placeholder rows (no recipeId) intentionally
                      stay silent. */}
                  {shouldShowRecipeRemovedBadge({
                    hasRecipe: planMealHasRecipe(meal),
                    recipeId: meal.recipeId,
                    knownRecipeIds,
                    libraryLoaded: recipeLibraryLoaded,
                  }) ? (
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
                {/* 2026-05-22 evening (Grace 3-row cleanup): inline
                    Swap (refresh icon) + Log as planned buttons removed
                    from each Plan row. Both actions remain available
                    via the overflow [⋯] menu (already exposes "Log as
                    planned" + "Swap recipe" + "Change portion size" +
                    "Move to different meal" + "Remove from plan").
                    Reduces trailing chrome from three buttons → one
                    per row × 28 rows = much calmer scroll. */}
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    // 2026-05-23 — was launching `Alert.alert` with a
                    // 4-button stack which iOS 26 renders as the fat
                    // "Liquid Glass" pill alert (out of character vs
                    // the rest of Suppr's UI). Now opens the on-brand
                    // `rowMenu` bottom sheet defined below. Same
                    // actions, same handlers — just on a surface that
                    // matches the chip-sheet + portion-modal pattern.
                    setRowMenu({ dayIdx, mealIndexInDay });
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
                  style={styles.addSlotBar}
                  testID={`planner-add-slot-back-${dp.day}`}
                >
                  <Text style={styles.addSlotLabel}>Add</Text>
                  <View style={styles.addSlotRow}>
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
                        style={styles.addSlotChip}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${slot} slot`}
                        testID={`planner-add-slot-${dp.day}-${slot}`}
                      >
                        <Plus size={12} color={colors.textSecondary} strokeWidth={2} />
                        <Text style={styles.addSlotChipText} numberOfLines={1}>
                          {compactPlanSlotLabel(slot)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })()}
            </View>
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
                    backgroundColor: accent.primary + "26",
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
        </ReAnimated.View>
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
      {/* 2026-05-23 — Plan chip-sheets. Two focused bottom sheets that
          back the two chips above the day stack: length+start, and
          which meals to include. Each sheet exposes the same controls
          the inline setup card used to host, but one decision at a
          time on a dedicated surface. */}
      <Modal
        visible={chipSheet === "lengthStart"}
        transparent
        animationType="fade"
        onRequestClose={() => setChipSheet(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setChipSheet(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              paddingTop: Spacing.md,
              paddingBottom: insets.bottom + Spacing.lg,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 999, alignSelf: "center", marginBottom: Spacing.md }} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
              {planSourceSelector ? "Plan setup" : "Plan length & start"}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
              {planSourceSelector
                ? "Where recipes come from, how many days, and when it starts."
                : "How many days, and when does the plan start?"}
            </Text>

            {/* ENG-790 — source selector also reachable when regenerating an
                existing plan (the empty/generate form is hidden once a plan
                exists). Same `planSource` state, so it stays in sync. */}
            {planSourceSelector && (
              <PlanSourceSelector
                mode={planSource}
                onChange={setPlanSource}
                libraryCount={savedRecipes.length}
                discoverCount={discoverCount}
              />
            )}

            <Text style={[styles.sectionLabel, planSourceSelector && { marginTop: Spacing.md }]}>Plan length</Text>
            <View style={styles.daysRow}>
              {([1, 3, 7] as const).map((d) => {
                const locked = isFree && d > 1;
                return (
                  <Pressable
                    key={d}
                    style={[styles.dayBtn, days === d && (primaryPills ? styles.dayBtnActivePrimary : styles.dayBtnActive), locked && { opacity: 0.5 }]}
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
                      <Text style={[styles.dayBtnText, days === d && (primaryPills ? styles.dayBtnTextActivePrimary : styles.dayBtnTextActive)]}>
                        {d} day{d > 1 ? "s" : ""}
                      </Text>
                      {locked ? (
                        <Lock size={11} color={days === d ? Accent.success : Accent.warning} strokeWidth={2} accessibilityLabel="Pro only" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>Start from</Text>
            <View style={styles.daysRow}>
              {([
                { val: 0 as const, label: "Today" },
                { val: 1 as const, label: "Tomorrow" },
                { val: 7 as const, label: "Next week" },
              ]).map((o) => (
                <Pressable
                  key={o.val}
                  style={[styles.dayBtn, startOffset === o.val && (primaryPills ? styles.dayBtnActivePrimary : styles.dayBtnActive)]}
                  onPress={() => setStartOffset(o.val)}
                >
                  <Text style={[styles.dayBtnText, startOffset === o.val && (primaryPills ? styles.dayBtnTextActivePrimary : styles.dayBtnTextActive)]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setChipSheet(null)}
              style={{
                marginTop: Spacing.lg,
                backgroundColor: accent.primary,
                paddingVertical: 13,
                borderRadius: Radius.md,
                alignItems: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={chipSheet === "meals"}
        transparent
        animationType="fade"
        onRequestClose={() => setChipSheet(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setChipSheet(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              paddingTop: Spacing.md,
              paddingBottom: insets.bottom + Spacing.lg,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 999, alignSelf: "center", marginBottom: Spacing.md }} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
              Which meals?
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
              Pick which slots Sloe fills when you regenerate.
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
              {ALL_MEAL_SLOTS.map((slot) => {
                const active = enabledSlots.has(slot);
                return (
                  <Pressable
                    key={slot}
                    style={[styles.dayBtn, active && (primaryPills ? styles.dayBtnActivePrimary : styles.dayBtnActive)]}
                    onPress={() => toggleSlot(slot)}
                  >
                    {active ? (
                      <CheckCircle2 size={14} color={primaryPills ? colors.tint : accent.primary} strokeWidth={2} style={{ marginRight: 4 }} />
                    ) : (
                      <Circle size={14} color={colors.textSecondary} strokeWidth={1.75} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.dayBtnText, active && (primaryPills ? styles.dayBtnTextActivePrimary : styles.dayBtnTextActive)]}>{slot}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setChipSheet(null)}
              style={{
                marginTop: Spacing.lg,
                backgroundColor: accent.primary,
                paddingVertical: 13,
                borderRadius: Radius.md,
                alignItems: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 2026-05-23 — Row action sheet. Triggered from the [⋯] overflow
          on any plan-row. Shows Log as planned / Change portion size /
          Move to different meal / Remove from plan as flat list rows
          on a calm bottom sheet — replaces the iOS fat-pill Alert that
          read as out-of-character UI on iOS 26. */}
      <Modal
        visible={rowMenu != null}
        transparent
        animationType="fade"
        onRequestClose={() => setRowMenu(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setRowMenu(null)}
        >
          {(() => {
            if (!rowMenu) return <View />;
            const meal = plan?.[rowMenu.dayIdx]?.meals[rowMenu.mealIndexInDay];
            if (!meal) return <View />;
            const hasRecipeOv = planMealHasRecipe(meal);
            const sourceDayOv = plan?.[rowMenu.dayIdx]?.day;
            const dayIdx = rowMenu.dayIdx;
            const mealIndexInDay = rowMenu.mealIndexInDay;

            const doLogAsPlanned = async () => {
              setRowMenu(null);
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
                Alert.alert(`${meal.recipeTitle} logged`, "Added to today's tracker.");
              }
            };
            const doViewRecipe = () => {
              setRowMenu(null);
              const id =
                meal.recipeId ??
                savedRecipes.find((x) => x.title === meal.recipeTitle)?.id ??
                discoverRecipes.find((x) => x.title === meal.recipeTitle)?.id;
              if (id) router.push(`/recipe/${id}` as Href);
            };
            const doSwap = () => {
              setRowMenu(null);
              swapMeal(dayIdx, mealIndexInDay, meal.name);
            };
            const doChangePortion = () => {
              setRowMenu(null);
              setPortionModal({ dayIdx, mealIndex: mealIndexInDay });
            };
            const doMove = () => {
              setRowMenu(null);
              if (!hasRecipeOv) {
                Alert.alert("Nothing to move", "This slot is empty.");
                return;
              }
              if (sourceDayOv == null || mealIndexInDay < 0) return;
              // Leftover-aware confirmation — if this meal is a parent
              // of downstream leftovers, flag the N we'll clear before
              // opening the move sheet (parity with the prior long-
              // press flow).
              const rid = meal.recipeId;
              const leftoverCount =
                rid && plan ? countLeftoversOfRecipe(plan, rid) : 0;
              const openSheet = () => {
                setMoveSource({ day: sourceDayOv, slotIndex: mealIndexInDay });
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
                            (d) => d.day === sourceDayOv,
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
            };
            const doRemove = () => {
              setRowMenu(null);
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
            };

            const ActionRow = ({
              label,
              onPress,
              destructive,
              testID,
            }: {
              label: string;
              onPress: () => void;
              destructive?: boolean;
              testID?: string;
            }) => (
              <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={label}
                testID={testID}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: Spacing.xl,
                  borderTopWidth: 1,
                  borderTopColor: colors.border + "60",
                  backgroundColor: pressed ? colors.border + "30" : "transparent",
                })}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "500",
                    color: destructive ? Accent.destructive : colors.text,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );

            return (
              <Pressable
                onPress={(e) => e.stopPropagation?.()}
                style={{
                  backgroundColor: colors.card,
                  borderTopLeftRadius: Radius.lg,
                  borderTopRightRadius: Radius.lg,
                  paddingTop: Spacing.md,
                  paddingBottom: insets.bottom + Spacing.sm,
                }}
              >
                <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 999, alignSelf: "center", marginBottom: Spacing.md }} />
                <View style={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md }}>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                    {hasRecipeOv ? meal.recipeTitle : meal.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {hasRecipeOv ? `${Math.round(meal.calories)} kcal · ${meal.name}` : "Empty slot"}
                  </Text>
                </View>
                {hasRecipeOv ? (
                  <>
                    <ActionRow label="Log as planned" onPress={doLogAsPlanned} testID="row-action-log" />
                    <ActionRow label="View recipe" onPress={doViewRecipe} testID="row-action-view" />
                    <ActionRow label="Swap meal" onPress={doSwap} testID="row-action-swap" />
                    <ActionRow label="Change portion size…" onPress={doChangePortion} testID="row-action-portion" />
                  </>
                ) : (
                  <ActionRow label="Swap meal" onPress={doSwap} testID="row-action-swap" />
                )}
                <ActionRow label="Move to different meal" onPress={doMove} testID="row-action-move" />
                <ActionRow label="Remove from plan" onPress={doRemove} destructive testID="row-action-remove" />
                <View style={{ height: Spacing.sm }} />
                <Pressable
                  onPress={() => setRowMenu(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  style={{
                    marginHorizontal: Spacing.xl,
                    paddingVertical: 13,
                    borderRadius: Radius.md,
                    backgroundColor: colors.border + "60",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>Cancel</Text>
                </Pressable>
              </Pressable>
            );
          })()}
        </Pressable>
      </Modal>

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
              <Text style={{ fontSize: 16, fontWeight: "600", color: accent.primary }}>Cancel</Text>
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
