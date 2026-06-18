import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import {
  effectivePortionMultiplier,
  isMealPlanPlaceholderLikeTitle,
} from "../lib/nutrition/portionMultiplier.ts";
import { formatRecipeMinutes } from "../lib/recipe/formatRecipeMinutes.ts";
import { supabase } from "../lib/supabase/browserClient.ts";
import type {
  DayPlan,
  LibraryEntryKind,
  LoggedMeal,
  RecipeCard,
  ShoppingItem,
  UserTier,
} from "../types/recipe.ts";
import { normaliseTier } from "../types/recipe.ts";
import { type AppNotification, type NotificationPrefs } from "../types/notifications.ts";
import { useNotifications } from "./NotificationContext.tsx";
import {
  DEFAULT_PLANNER_BANDS,
  mealPlannerSlotsFromMealType,
  type PlannerTargets,
} from "../lib/planning/generateMealPlan.ts";
import { clearLocalProfile, loadLocalProfile } from "../lib/profile/profileStorage.ts";
import { normalizeMacroTargets, type MacroTargets } from "../types/profile.ts";
import { clampTargetToSafetyFloor, coerceSex } from "../lib/onboarding/targets.ts";
import {
  coerceWeightSurfaceMode,
  type WeightSurfaceMode,
} from "../lib/nutrition/weightSurfaceMode.ts";
import { AnalyticsEvents, type FoodLoggedSource } from "../lib/analytics/events.ts";
import { track } from "../lib/analytics/track.ts";
import { useAuthSession } from "./AuthSessionContext.tsx";
import {
  dateKey,
  DEFAULT_MEAL_PLAN_SLOT_ID,
  loadSnapshot,
  newId,
  type MealPlanNamedSlot,
} from "./appData/persistence.ts";
import { DEFAULT_UPLOADED_RECIPE_IMAGE, FREE_SAVE_LIMIT } from "./appData/constants.ts";
import { NEUTRAL_AVATAR_DATA_URI } from "@/lib/ui/neutralAvatar";
import { fetchPublicRecipeSaveCounts } from "../lib/recipes/fetchPublicRecipeSaveCounts.ts";
import { normalizeRecipeTitle } from "../lib/recipes/normalizeRecipeTitle.ts";
import { SEED_RECIPES_V2 } from "../lib/recipes/seedRecipesV2.ts";
import { seedsToRecipeCards } from "../lib/recipes/seedRecipesToCard.ts";
import {
  looksLikeMissingTableError,
  syncDisabledBecauseSchemaMessage,
  syncFailedRetryMessage,
} from "./appData/supabaseErrors.ts";
import { useNutritionJournalState } from "./appData/useNutritionJournalState.ts";
import { usePersistLocalAppSnapshot } from "./appData/usePersistLocalAppSnapshot.ts";
import { useRetryEnableDbTable } from "./appData/useRetryEnableDbTable.ts";
import { useShoppingListState } from "./appData/useShoppingListState.ts";
import { fingerprintMealPlanForShopping } from "../lib/planning/mealPlanFingerprint.ts";
import { getMyHousehold } from "../lib/household/householdClient.ts";
import {
  shoppingScopeFor,
  shoppingScopeInsertStamp,
  type ShoppingScope,
} from "../lib/household/shoppingScope.ts";
import { isAuthLockAbort } from "../lib/supabase/isAuthLockAbort.ts";
import { filterOrphanSaves } from "../lib/recipes/filterOrphanSaves.ts";
import { composeLibraryEntries } from "../lib/recipes/composeLibraryEntries.ts";
import { savedRecipesForPlanning } from "../lib/planning/savedRecipesForPlanning.ts";
import {
  type PlanSourceMode,
  selectPlanPool,
  canGenerateFromSource,
} from "../lib/planning/planSource.ts";
import {
  generateShoppingListFromRecipeEntries,
  shoppingListIngredientMultiplier,
  type RecipeIngredientRow,
} from "../lib/planning/generateShoppingList.ts";
import {
  filterShoppingItemsByPantry,
  parsePantryStaples,
} from "../lib/planning/pantryStaples.ts";
import { startDateForOffset } from "../lib/mealPlan/planCalendarAnchor.ts";
import {
  cloudSlotIdFromLocal,
  fetchMealPlanForLocalSlot,
  mergeCloudMetadataIntoSlots,
  metadataFromSlots,
  parseMealPlanSlotsMetadata,
} from "../lib/mealPlan/slotCloudSync.ts";
import { shoppingListShouldClear } from "../lib/planning/shoppingListLifecycle.ts";

export type RedeemPromoResult =
  | { ok: true; tier: UserTier; alreadyRedeemed?: boolean }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_code"
        | "invalid_or_expired"
        | "already_redeemed"
        | "rpc_error"
        | "not_deployed";
      message?: string;
    };

interface AppDataContextValue {
  /** Signed-in user id, when available (for library labels). */
  userId: string | null;
  authEmail: string | null;
  profileDisplayName: string | null;
  profileTier: UserTier;
  profileTimeZone: string | null;
  /** Re-fetch tier/display/targets from Supabase (e.g. after Stripe checkout). */
  refreshProfileBasics: () => Promise<void>;
  /** Display preference from profile; internal storage remains metric. */
  profileMeasurementSystem: "metric" | "imperial";
  setProfileMeasurementSystem: Dispatch<SetStateAction<"metric" | "imperial">>;
  /** T13 (2026-04-24) — Digest + Progress + weight-chart opt-out for
   *  ED / dysphoria-sensitive users. `"show"` is legacy default; users
   *  opt into `"hide"` / `"trends_only"` under Settings. */
  profileWeightSurfaceMode: WeightSurfaceMode;
  setProfileWeightSurfaceMode: Dispatch<SetStateAction<WeightSurfaceMode>>;
  redeemPromoCode: (code: string) => Promise<RedeemPromoResult>;
  signOut: () => Promise<void>;
  generateMealPlan: (options?: {
    targetsOverride?: Partial<PlannerTargets>;
    days?: number;
    /**
     * F2-H (audit 2026-04-28) — caller-controlled slot list (e.g.
     * `["Breakfast", "Lunch", "Dinner"]` to skip Snacks). Defaults
     * to all four canonical slots when omitted.
     */
    slots?: string[];
  }) => Promise<void>;
  generateShoppingListFromPlan: () => Promise<void>;
  /** True when the list was built from the planner and the meal plan (or portions) has changed since. */
  shoppingListOutOfSync: boolean;
  /** ENG-1135 — calendar date the shopping list was generated from (`YYYY-MM-DD`). */
  shoppingListPlanStartDate: string | null;
  /** ENG-1051 — always-on-hand staples suppressed from shopping generation. */
  pantryStaples: readonly string[];
  savePantryStaples: (staples: readonly string[]) => Promise<void>;
  discoverRecipes: RecipeCard[];
  /** Recipes published by real users. Catalog picks are excluded. */
  communityFeedCount: number;
  refreshDiscoverRecipes: () => Promise<void>;
  /** Returns true when a new save was started (not un-save, not blocked by tier limit). */
  toggleSaveRecipe: (recipeId: string, tier: UserTier, kind?: LibraryEntryKind) => boolean;
  /** Add a recipe to the library with a source label (e.g. after create/import save). */
  ensureRecipeInLibraryWithKind: (recipeId: string, kind: LibraryEntryKind) => void;
  /** Per-recipe library source; keys are recipe ids. */
  libraryEntryKindByRecipeId: Readonly<Record<string, LibraryEntryKind>>;
  /** Cached card metadata so saved recipes can be shown even if unpublished later. */
  savedRecipeMetaById: Readonly<Record<string, { title: string }>>;
  /** Refresh your private drafts/published recipes for Library display. */
  refreshMyLibraryRecipes: () => Promise<void>;
  /** Duplicate a recipe into a new private draft under your account. */
  duplicateRecipeToCreatedDraft: (sourceRecipeId: string) => Promise<string | null>;
  isRecipeSaved: (recipeId: string) => boolean;
  savedRecipesForLibrary: Array<RecipeCard & { savedAt: Date }>;
  shoppingItems: ShoppingItem[];
  setShoppingItems: Dispatch<SetStateAction<ShoppingItem[]>>;
  toggleShoppingChecked: (itemId: string) => void;
  removeShoppingItem: (itemId: string) => void;
  addShoppingItem: (item: Omit<ShoppingItem, "id" | "checked"> & { checked?: boolean }) => void;
  /**
   * Honeydew parity (2026-04-30): the user's active household id, or
   * null when solo. Surfaced so the ShoppingList component can render
   * the "Shared with Sarah & Tom" banner + per-row attribution chips
   * without re-fetching `getMyHousehold` itself.
   */
  activeHouseholdId: string | null;
  nutritionTargets: MacroTargets;
  setNutritionTargets: Dispatch<SetStateAction<MacroTargets>>;
  preferActivityAdjustedCalories: boolean;
  setPreferActivityAdjustedCalories: Dispatch<SetStateAction<boolean>>;
  /** P2-26 / P3-30 (2026-04-25): when true, the user has opted into the
   *  net-carbs lens via Settings → Goals & Targets. Surfaces that
   *  display carbs (Tracker macro tile, Recipe Detail nutrition row)
   *  swap "Carbs" → "Net carbs" and the value subtracts fibre.
   *  Source of truth: `profiles.net_carbs_lens_enabled`. */
  netCarbsLensEnabled: boolean;
  setNetCarbsLensEnabled: Dispatch<SetStateAction<boolean>>;
  /** Default activity burn (kcal) for days without a per-day value in `activityBurnByDay`. */
  activityBurnKcal: number;
  setActivityBurnKcal: Dispatch<SetStateAction<number>>;
  /** Activity burn for the selected tracker day (per-day override or default). */
  activityBurnForSelectedDay: number;
  /** Per-day active energy (kcal) for multi-day summaries. */
  activityBurnByDay: Record<string, number>;
  setActivityBurnForSelectedDay: (kcal: number) => void;
  /** Quick-add water (ml) for the selected day, in addition to per-meal water. */
  addWaterMlForSelectedDay: (ml: number) => void;
  extraWaterMlForSelectedDay: number;
  /** Per-day workout list from Apple Health / Health Connect. */
  workoutsByDay: Record<string, Array<{ type: string; minutes: number; calories: number; source: string }>>;
  /** Per-day resting (basal) energy burned in kcal from Apple Health. */
  basalBurnByDay: Record<string, number>;
  /** All quick-add water amounts by `YYYY-MM-DD` (for weekly summaries / export). */
  extraWaterByDay: Record<string, number>;
  /** Quick-add caffeine (mg) for the selected day. Batch 2.5. */
  addCaffeineMgForSelectedDay: (mg: number, preset?: string | null) => void;
  extraCaffeineMgForSelectedDay: number;
  /** All caffeine entries keyed by `YYYY-MM-DD` (mg). */
  extraCaffeineByDay: Record<string, number>;
  /** Quick-add alcohol (grams of ethanol) for the selected day. Batch 2.5. */
  addAlcoholGForSelectedDay: (grams: number, preset?: string | null) => void;
  extraAlcoholGForSelectedDay: number;
  /** All alcohol entries keyed by `YYYY-MM-DD` (grams). */
  extraAlcoholGByDay: Record<string, number>;
  /** Reset all hydration + stimulant entries for one day. */
  resetHydrationStimulantsForDay: (dayKey: string, kind: "water" | "caffeine" | "alcohol") => void;
  /** Caffeine daily target in mg (default 400 — FDA). */
  targetCaffeineMg: number;
  setTargetCaffeineMg: Dispatch<SetStateAction<number>>;
  /** Alcohol weekly target in grams. 0 = hidden (default). */
  targetAlcoholGWeekly: number;
  setTargetAlcoholGWeekly: Dispatch<SetStateAction<number>>;
  selectedDateKey: string;
  setSelectedDateKey: Dispatch<SetStateAction<string>>;
  mealsForSelectedDate: LoggedMeal[];
  /**
   * L6 G1 (2026-04-18) — optional `analyticsSource` threaded through to
   * the `food_logged` event that the primitive fires. Defaults to
   * `"manual"` at the hook so legacy callers keep working; call sites
   * that originate from a specific flow (quick_add / recipe / planner
   * / barcode / voice / photo / copy_meal / duplicate_day / saved_meal
   * / custom_food) pass the matching enum so dashboards can slice.
   */
  addLoggedMeal: (meal: Omit<LoggedMeal, "id">, analyticsSource?: FoodLoggedSource) => string;
  addLoggedMealForDate: (
    dayKey: string,
    meal: Omit<LoggedMeal, "id">,
    analyticsSource?: FoodLoggedSource,
  ) => string;
  removeLoggedMeal: (mealId: string) => void;
  /** ENG-1122 — optimistic update + Supabase persist for edited journal rows. */
  updateLoggedMeal: (dayKey: string, updated: LoggedMeal) => Promise<boolean>;
  /** Copy one logged meal to another day (batch 1.4 — copy meal / duplicate day). */
  copyMealToDate: (sourceDayKey: string, mealId: string, targetDayKey: string) => Promise<void>;
  /** Copy one logged meal to every day in the deduped, source-excluded target list. */
  copyMealToDateRange: (sourceDayKey: string, mealId: string, targetDayKeys: string[]) => Promise<void>;
  /** Duplicate every meal from the source day into a single target day. */
  duplicateDay: (sourceDayKey: string, targetDayKey: string) => Promise<void>;
  /** Duplicate every meal from the source day into every day in the deduped target list. */
  duplicateDayToDateRange: (sourceDayKey: string, targetDayKeys: string[]) => Promise<void>;
  mealPlan: DayPlan[] | null;
  setMealPlan: Dispatch<SetStateAction<DayPlan[] | null>>;
  mealPlanSlots: MealPlanNamedSlot[];
  activeMealPlanSlotId: string;
  switchMealPlanSlot: (slotId: string) => void;
  createMealPlanSlot: (name: string) => string;
  renameMealPlanSlot: (slotId: string, name: string) => void;
  deleteMealPlanSlot: (slotId: string) => void;
  /** All logged meals by `YYYY-MM-DD` (for streaks / weekly stats in Tracker). */
  /** ENG-889 — true once the first nutrition_entries fetch settles (web Today skeleton gate). */
  nutritionJournalHydrated: boolean;
  nutritionByDay: Record<string, LoggedMeal[]>;
  /** In-app notifications inbox (newest-first). */
  notificationsInbox: AppNotification[];
  notificationsUnreadCount: number;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: Dispatch<SetStateAction<NotificationPrefs>>;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  /** Add a notification to the local inbox (respects prefs when used by UI). */
  addNotification: (n: Omit<AppNotification, "id" | "createdAt" | "readAt">) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { authedUserId, authEmail } = useAuthSession();
  const initial = useMemo(() => loadSnapshot(), []);

  // Notifications are now managed by NotificationContext (wrapped above in providers.tsx).
  const notifications = useNotifications();

  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>(initial.savedRecipeIds);
  const [savedAtById, setSavedAtById] = useState<Record<string, string>>(initial.savedAtById);
  const [savedRecipeMetaById, setSavedRecipeMetaById] = useState<
    NonNullable<NonNullable<typeof initial>["savedRecipeMetaById"]>
  >(() => initial.savedRecipeMetaById ?? {});
  const [libraryEntryKindByRecipeId, setLibraryEntryKindByRecipeId] = useState<
    Record<string, LibraryEntryKind>
  >(() => initial.libraryEntryKindByRecipeId ?? {});
  const [uploadedRecipes, setUploadedRecipes] = useState<RecipeCard[]>([]);
  const [myLibraryRecipes, setMyLibraryRecipes] = useState<RecipeCard[]>([]);
  const [mealPlanSlots, setMealPlanSlots] = useState<MealPlanNamedSlot[]>(() => {
    if (initial.mealPlanSlots?.length) {
      return initial.mealPlanSlots;
    }
    return [{ id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: initial.mealPlan }];
  });
  const [activeMealPlanSlotId, setActiveMealPlanSlotId] = useState(
    () => initial.activeMealPlanSlotId ?? DEFAULT_MEAL_PLAN_SLOT_ID,
  );
  const activeMealPlanSlotIdRef = useRef(activeMealPlanSlotId);
  activeMealPlanSlotIdRef.current = activeMealPlanSlotId;
  /** ENG-1130: skip metadata write-back until profile meal_plan_slots hydrates. */
  const mealPlanSlotsCloudLoadedRef = useRef(false);
  const mealPlanSlotsRef = useRef(mealPlanSlots);
  mealPlanSlotsRef.current = mealPlanSlots;

  const mealPlan = useMemo(() => {
    return mealPlanSlots.find((s) => s.id === activeMealPlanSlotId)?.plan ?? null;
  }, [mealPlanSlots, activeMealPlanSlotId]);

  // Notification state is now fully managed by NotificationContext.
  // Destructure here so the bridge value object and internal references (e.g. generateMealPlan calling pushNotification) still work.
  const {
    notificationsInbox,
    notificationsUnreadCount,
    notificationPrefs,
    setNotificationPrefs,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    addNotification: pushNotification,
  } = notifications;

  const setMealPlan = useCallback(
    (action: SetStateAction<DayPlan[] | null>) => {
      setMealPlanSlots((prev) =>
        prev.map((s) => {
          if (s.id !== activeMealPlanSlotIdRef.current) return s;
          const next =
            typeof action === "function"
              ? (action as (p: DayPlan[] | null) => DayPlan[] | null)(s.plan)
              : action;
          return { ...s, plan: next };
        }),
      );
    },
    [],
  );

  const createMealPlanSlot = useCallback((name: string) => {
    const id = newId("planslot");
    const label = name.trim() || "New plan";
    setMealPlanSlots((prev) => [...prev, { id, name: label, plan: null }]);
    setActiveMealPlanSlotId(id);
    return id;
  }, []);

  const renameMealPlanSlot = useCallback((slotId: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    setMealPlanSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, name: n } : s)));
  }, []);

  const deleteMealPlanSlot = useCallback((slotId: string) => {
    setMealPlanSlots((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((s) => s.id !== slotId);
      if (activeMealPlanSlotIdRef.current === slotId) {
        setActiveMealPlanSlotId(filtered[0]!.id);
      }
      return filtered;
    });
  }, []);
  const [nutritionTargets, setNutritionTargets] = useState(initial.nutritionTargets);
  const [preferActivityAdjustedCalories, setPreferActivityAdjustedCalories] = useState(false);
  // P3-30 (2026-04-25): net-carbs lens opt-in. Default false to preserve
  // current behaviour for users who haven't opted in.
  const [netCarbsLensEnabled, setNetCarbsLensEnabled] = useState(false);
  const [activityBurnKcal, setActivityBurnKcal] = useState(() => initial.activityBurnKcal ?? 0);
  const [activityBurnByDay, setActivityBurnByDay] = useState<Record<string, number>>(
    () => initial.activityBurnByDay ?? {},
  );
  const [extraWaterByDay, setExtraWaterByDay] = useState<Record<string, number>>(
    () => initial.extraWaterByDay ?? {},
  );
  const [extraCaffeineByDay, setExtraCaffeineByDay] = useState<Record<string, number>>({});
  const [extraAlcoholGByDay, setExtraAlcoholGByDay] = useState<Record<string, number>>({});
  const [targetCaffeineMg, setTargetCaffeineMg] = useState<number>(400);
  const [targetAlcoholGWeekly, setTargetAlcoholGWeekly] = useState<number>(0);
  const [workoutsByDay, setWorkoutsByDay] = useState<Record<string, Array<{ type: string; minutes: number; calories: number; source: string }>>>({});
  const [basalBurnByDay, setBasalBurnByDay] = useState<Record<string, number>>({});
  /** Guard: skip debounced write-back until the initial Supabase fetch resolves. */
  const waterActivityLoadedRef = useRef(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profileTier, setProfileTier] = useState<UserTier>("free");
  const [profileTimeZone, setProfileTimeZone] = useState<string | null>(null);
  const [profileMeasurementSystem, setProfileMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [profileWeightSurfaceMode, setProfileWeightSurfaceMode] = useState<WeightSurfaceMode>("show");
  const [dbSavesEnabled, setDbSavesEnabled] = useState(true);
  const [dbSavesWarned, setDbSavesWarned] = useState(false);
  const [, setIsGeneratingPlan] = useState(false);
  const [dbMealPlanEnabled, setDbMealPlanEnabled] = useState(true);
  const [dbMealPlanWarned, setDbMealPlanWarned] = useState(false);

  const switchMealPlanSlot = useCallback(
    (slotId: string) => {
      if (!mealPlanSlotsRef.current.some((s) => s.id === slotId)) return;
      setActiveMealPlanSlotId(slotId);
      if (!authedUserId || !dbMealPlanEnabled) return;
      const target = mealPlanSlotsRef.current.find((s) => s.id === slotId);
      if (target?.plan) return;
      void (async () => {
        const loaded = await fetchMealPlanForLocalSlot(supabase, authedUserId, slotId);
        if (!loaded?.plans.length) return;
        setMealPlanSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, plan: loaded.plans } : s)),
        );
      })();
    },
    [authedUserId, dbMealPlanEnabled],
  );

  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => dateKey(new Date()));

  // Honeydew parity (2026-04-30) — resolve the user's active household
  // once on auth, and re-resolve after a join/leave (best-effort: we
  // don't yet emit a global "household changed" event, but the
  // HouseholdSettingsPage hard-reloads on those flows so the next
  // mount picks up the new id). Drives scope on
  // `useShoppingListState` and on the local generate / clear paths.
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  useEffect(() => {
    if (!authedUserId) { setActiveHouseholdId(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getMyHousehold(supabase as unknown as { from: (t: string) => unknown; rpc: (f: string, p: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }, authedUserId);
        if (!cancelled) {
          const hh = (data as { household?: { id?: string } | null } | null)?.household;
          setActiveHouseholdId(hh?.id ?? null);
        }
      } catch {
        if (!cancelled) setActiveHouseholdId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [authedUserId]);

  const shoppingScope: ShoppingScope | null = useMemo(() => {
    if (!authedUserId) return null;
    return shoppingScopeFor({ userId: authedUserId, householdId: activeHouseholdId });
  }, [authedUserId, activeHouseholdId]);

  const {
    shoppingItems,
    setShoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
  } = useShoppingListState({
    authedUserId,
    initialItems: initial.shoppingItems,
    activeHouseholdId,
  });

  const [shoppingListSourceFingerprint, setShoppingListSourceFingerprint] = useState<string | null>(
    initial.shoppingListSourceFingerprint ?? null,
  );
  const [shoppingListPlanStartDate, setShoppingListPlanStartDate] = useState<string | null>(
    initial.shoppingListPlanStartDate ?? null,
  );
  const [pantryStaples, setPantryStaples] = useState<readonly string[]>(
    initial.pantryStaples ?? [],
  );

  const {
    journalHydrated: nutritionJournalHydrated,
    nutritionByDay,
    addLoggedMealForDate,
    addLoggedMeal,
    removeLoggedMeal,
    updateLoggedMeal,
    mealsForSelectedDate,
    copyMealToDate,
    copyMealToDateRange,
    duplicateDay,
    duplicateDayToDateRange,
  } = useNutritionJournalState({
    authedUserId,
    initialByDay: initial.nutritionByDay,
    selectedDateKey,
    profileTimeZone,
  });

  const tryEnableDbSaves = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("saves").select("recipe_id").limit(1);
    if (error) {
      return false;
    }
    setDbSavesEnabled(true);
    return true;
  }, [authedUserId]);

  const tryEnableDbMealPlans = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("meal_plan_days").select("id").limit(1);
    if (!error) {
      setDbMealPlanEnabled(true);
      return true;
    }
    // Schema refactor Phase 3 (2026-05-11) — legacy `meal_plans` JSONB
    // probe removed (table dropped 2026-04-21). meal_plan_days is the
    // only path now.
    return false;
  }, [authedUserId]);

  useRetryEnableDbTable(authedUserId, dbSavesEnabled, tryEnableDbSaves);
  useRetryEnableDbTable(authedUserId, dbMealPlanEnabled, tryEnableDbMealPlans);

  const shoppingListOutOfSync = useMemo(() => {
    if (shoppingItems.length === 0) return false;
    if (shoppingListSourceFingerprint === null) return false;
    return fingerprintMealPlanForShopping(mealPlan) !== shoppingListSourceFingerprint;
  }, [shoppingItems.length, shoppingListSourceFingerprint, mealPlan]);

  // F-9 (TestFlight `AMXSjeaXJeCf6QtKgUTMkD0`, 2026-04-18): the
  // shopping list is ephemeral — it belongs to the active meal plan.
  // When there is no plan on the active slot (fresh account, slot
  // deleted, or user switched to an empty slot) any leftover
  // `shopping_items` rows from a previous plan should NOT show. The
  // tester saw "37 items from this week" on the Plan tab before ever
  // generating a plan; the rule below (pure helper in
  // src/lib/planning/shoppingListLifecycle.ts) guards against that
  // without clobbering a freshly-built list during a regenerate.
  const priorMealPlanRef = useRef<typeof mealPlan>(mealPlan);
  useEffect(() => {
    const prev = priorMealPlanRef.current;
    priorMealPlanRef.current = mealPlan;
    const decision = shoppingListShouldClear({
      previousPlan: prev,
      currentPlan: mealPlan,
      hasLocalItems: shoppingItems.length > 0,
      hasSourceFingerprint: shoppingListSourceFingerprint !== null,
    });
    if (!decision.clearLocal && !decision.clearServer) return;
    if (decision.clearLocal) {
      setShoppingItems([]);
      setShoppingListSourceFingerprint(null);
    }
    if (decision.clearServer && authedUserId && shoppingScope) {
      // 2026-04-30 (Honeydew parity): scope-aware wipe so a member
      // whose plan empties doesn't nuke the shared household list.
      let q = supabase.from("shopping_items").delete();
      if (shoppingScope.kind === "household") {
        q = q.eq("household_id", shoppingScope.householdId);
      } else {
        q = q.eq("user_id", authedUserId).is("household_id", null);
      }
      void q;
    }
  }, [mealPlan, shoppingItems.length, shoppingListSourceFingerprint, setShoppingItems, authedUserId, shoppingScope]);

  // Load profile basics (tier/display name). Falls back to local profile if needed.
  useEffect(() => {
    if (!authedUserId) {
      const local = loadLocalProfile(null);
      setProfileTier(local?.userTier ?? "free");
      setProfileDisplayName(local?.displayName ?? null);
      setProfileMeasurementSystem(local?.measurementSystem ?? "metric");
      if (local?.targets) {
        // ENG-793 floor-leak fix (degraded error / no-DB path): the local cache
        // can hold a sub-floor target (onboarding persists the soft-warn-not-block
        // derived value), so clamp it UP to the sex-aware floor here too. local.sex
        // is already the Sex union (UserProfile), so no coercion is needed.
        setNutritionTargets(
          normalizeMacroTargets({
            ...local.targets,
            calories: clampTargetToSafetyFloor(local.targets.calories, local.sex),
          }),
        );
      }
      setPreferActivityAdjustedCalories(local?.preferActivityAdjustedCalories ?? false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "display_name, user_tier, measurement_system, sex, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, prefer_activity_adjusted_calories, weight_surface_mode, net_carbs_lens_enabled, pantry_staples, meal_plan_slots, tz_iana",
        )
        .eq("id", authedUserId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        const local = loadLocalProfile(authedUserId);
        setProfileTier(local?.userTier ?? "free");
        setProfileDisplayName(local?.displayName ?? null);
        setProfileTimeZone(null);
        setProfileMeasurementSystem(local?.measurementSystem ?? "metric");
        if (local?.targets) {
          // ENG-793 floor-leak fix (degraded error / no-DB path): the local cache
        // can hold a sub-floor target (onboarding persists the soft-warn-not-block
        // derived value), so clamp it UP to the sex-aware floor here too. local.sex
        // is already the Sex union (UserProfile), so no coercion is needed.
        setNutritionTargets(
          normalizeMacroTargets({
            ...local.targets,
            calories: clampTargetToSafetyFloor(local.targets.calories, local.sex),
          }),
        );
        }
        setPreferActivityAdjustedCalories(local?.preferActivityAdjustedCalories ?? false);
        mealPlanSlotsCloudLoadedRef.current = true;
        return;
      }
      // `lifetime_pro` (ENG-1043 founding comp) is normalised to `pro` so every
      // downstream `profileTier === "pro"` gate covers founders.
      setProfileTier(normaliseTier(data?.user_tier as string | null | undefined));
      setProfileDisplayName((data?.display_name as string | null) ?? null);
      setProfileTimeZone(typeof data?.tz_iana === "string" ? data.tz_iana : null);
      const ms = data?.measurement_system === "imperial" ? "imperial" : "metric";
      setProfileMeasurementSystem(ms);
      setProfileWeightSurfaceMode(coerceWeightSurfaceMode(data?.weight_surface_mode));
      setPreferActivityAdjustedCalories(Boolean(data?.prefer_activity_adjusted_calories));
      // P3-30: lens defaults to false when the column hasn't been
      // populated yet (forward-only safe).
      setNetCarbsLensEnabled(Boolean((data as { net_carbs_lens_enabled?: boolean } | null)?.net_carbs_lens_enabled));
      setPantryStaples(parsePantryStaples((data as { pantry_staples?: unknown } | null)?.pantry_staples));
      const cloudSlotMeta = parseMealPlanSlotsMetadata(
        (data as { meal_plan_slots?: unknown } | null)?.meal_plan_slots,
      );
      if (cloudSlotMeta) {
        setMealPlanSlots((prev) => mergeCloudMetadataIntoSlots(prev, cloudSlotMeta).slots);
        setActiveMealPlanSlotId((prev) => {
          const merged = mergeCloudMetadataIntoSlots(mealPlanSlotsRef.current, cloudSlotMeta);
          return merged.activeSlotId ?? prev;
        });
      }
      mealPlanSlotsCloudLoadedRef.current = true;
      const hasTargets = Boolean(
        data?.target_calories &&
          data?.target_protein &&
          data?.target_carbs &&
          data?.target_fat,
      );
      if (hasTargets) {
        setNutritionTargets(
          normalizeMacroTargets({
            calories: data!.target_calories as number,
            protein: data!.target_protein as number,
            carbs: data!.target_carbs as number,
            fat: data!.target_fat as number,
            fiber: data!.target_fiber_g ?? undefined,
            waterMl: data!.target_water_ml ?? undefined,
          }),
        );
      } else {
        const local = loadLocalProfile(authedUserId);
        if (local?.targets) {
          // ENG-793 floor-leak fix (degraded error / no-DB path): the local cache
        // can hold a sub-floor target (onboarding persists the soft-warn-not-block
        // derived value), so clamp it UP to the sex-aware floor here too. local.sex
        // is already the Sex union (UserProfile), so no coercion is needed.
        setNutritionTargets(
          normalizeMacroTargets({
            ...local.targets,
            calories: clampTargetToSafetyFloor(local.targets.calories, local.sex),
          }),
        );
        }
        if (local) {
          setPreferActivityAdjustedCalories(local.preferActivityAdjustedCalories ?? false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  const refreshProfileBasics = useCallback(async () => {
    if (!authedUserId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "display_name, user_tier, measurement_system, sex, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, prefer_activity_adjusted_calories, weight_surface_mode, net_carbs_lens_enabled, tz_iana",
      )
      .eq("id", authedUserId)
      .maybeSingle();

    if (error) return;
    setProfileTier(normaliseTier(data?.user_tier as string | null | undefined));
    setProfileDisplayName((data?.display_name as string | null) ?? null);
    setProfileTimeZone(typeof data?.tz_iana === "string" ? data.tz_iana : null);
    const ms = data?.measurement_system === "imperial" ? "imperial" : "metric";
    setProfileMeasurementSystem(ms);
    setProfileWeightSurfaceMode(coerceWeightSurfaceMode(data?.weight_surface_mode));
    setPreferActivityAdjustedCalories(Boolean(data?.prefer_activity_adjusted_calories));
    setNetCarbsLensEnabled(Boolean((data as { net_carbs_lens_enabled?: boolean } | null)?.net_carbs_lens_enabled));
    const hasTargets = Boolean(
      data?.target_calories &&
        data?.target_protein &&
        data?.target_carbs &&
        data?.target_fat,
    );
    if (hasTargets) {
      setNutritionTargets(
        normalizeMacroTargets({
          // ENG-793 floor-leak fix: clamp the stored target UP to the sex-aware
          // safety floor at READ time so a sub-floor value (e.g. 901) can't reach
          // the Today ring. normalizeMacroTargets stays sex-free (it also serves
          // legacy snapshots + the local cache that lack sex).
          calories: clampTargetToSafetyFloor(
            data!.target_calories as number,
            coerceSex(data!.sex as string | null),
          ),
          protein: data!.target_protein as number,
          carbs: data!.target_carbs as number,
          fat: data!.target_fat as number,
          fiber: data!.target_fiber_g ?? undefined,
          waterMl: data!.target_water_ml ?? undefined,
        }),
      );
    }
  }, [authedUserId]);

  /**
   * P05 (audit 2026-05-05) — Supabase Realtime subscription on the
   * current user's `profiles` row.
   *
   * Background: web users completing a Stripe Checkout land on
   * `/home?checkout=success` before the Stripe webhook has finished
   * writing `profiles.user_tier = "pro"` to the database. The mount
   * fetches an old "free" tier; the UI shows Free until the user
   * happens to refresh. Mobile is fine — RevenueCat tells the app
   * directly. Web has no equivalent signal without polling or
   * subscribing.
   *
   * Realtime is the structurally-right answer: the moment the
   * webhook commits the row update, Supabase pushes the change here
   * and we re-fetch profile basics. No timer, no guess at how slow
   * Stripe is on a given day.
   */
  useEffect(() => {
    if (!authedUserId) return;
    const channel = supabase
      .channel(`profiles:${authedUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${authedUserId}`,
        },
        () => {
          void refreshProfileBasics();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authedUserId, refreshProfileBasics]);

  const redeemPromoCode = useCallback(async (code: string): Promise<RedeemPromoResult> => {
    if (!authedUserId) {
      return { ok: false, error: "not_authenticated" };
    }
    const trimmed = code.trim();
    if (!trimmed) {
      return { ok: false, error: "invalid_code" };
    }
    const { data, error } = await supabase.rpc("redeem_promo_code", {
      p_code: trimmed.toUpperCase(),
    });
    if (error) {
      if (looksLikeMissingTableError(error.message ?? "")) {
        return { ok: false, error: "not_deployed", message: error.message };
      }
      return { ok: false, error: "rpc_error", message: error.message };
    }
    let parsed: unknown = data;
    if (Array.isArray(parsed) && parsed.length === 1) parsed = parsed[0];
    for (let i = 0; i < 3; i++) {
      if (typeof parsed !== "string") break;
      try {
        parsed = JSON.parse(parsed) as unknown;
      } catch {
        break;
      }
    }
    const payload = parsed as {
      ok?: boolean | string;
      error?: string;
      tier?: string;
      already_redeemed?: boolean;
    } | null;
    const ok = payload?.ok === true || payload?.ok === "true";
    if (!ok) {
      const err = payload?.error;
      if (
        err === "not_authenticated" ||
        err === "invalid_code" ||
        err === "invalid_or_expired" ||
        err === "already_redeemed"
      ) {
        return { ok: false, error: err };
      }
      return { ok: false, error: "rpc_error", message: err ?? "unknown" };
    }
    // The RPC may return `lifetime_pro` (founding comp) — normalise to the
    // app-facing tier so the redemption result and every gate agree.
    const tier = normaliseTier(payload!.tier as string | null | undefined);
    setProfileTier(tier);
    return { ok: true, tier, alreadyRedeemed: Boolean(payload!.already_redeemed) };
  }, [authedUserId]);

  // Load persisted meal plan for the active named slot from Supabase.
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      if (!dbMealPlanEnabled) return;
      const slotId = activeMealPlanSlotIdRef.current;
      const loaded = await fetchMealPlanForLocalSlot(supabase, authedUserId, slotId);
      if (cancelled || !loaded?.plans.length) return;
      setMealPlanSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, plan: loaded.plans } : s)));
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbMealPlanEnabled, activeMealPlanSlotId]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    clearLocalProfile();
    window.location.href = "/login";
  }, []);

  const refreshDiscoverRecipes = useCallback(async () => {
    // GW-03/GW-04 fix (audit 2026-04-28): see the matching comment
    // in `apps/mobile/lib/recipes.ts`. The `.not("author_id", "is",
    // null)` filter has been removed so platform-curated rows
    // (author_id = NULL) surface in Discover; the seeder now writes
    // NULL per the data-integrity remediation.
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, title, image_url, servings, is_verified, creator_calories, calories, protein, carbs, fat, fiber_g, created_at, author_id, creator_id, meal_type, prep_time_min, cook_time_min, allergens, dietary_flags, author:profiles!recipes_author_id_fkey(display_name, avatar_url)",
      )
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      // `@supabase/ssr` uses `navigator.locks` for the auth refresh
      // critical section. When two queries fire in parallel (e.g.
      // Today refresh + Discover refresh on app focus) the second can
      // steal the lock and the first rejects with
      // `AbortError: Lock was stolen by another request`. The data
      // fetch is unaffected — the next poll succeeds normally — so
      // we treat this as benign and skip noisy error logging.
      if (isAuthLockAbort(error)) return;
      console.error("[refreshDiscoverRecipes] failed:", error.message);
      return;
    }

    const mapped: RecipeCard[] = (data ?? []).map((row: any) => {
      const prepM = row.prep_time_min != null ? Number(row.prep_time_min) : NaN;
      const cookM = row.cook_time_min != null ? Number(row.cook_time_min) : NaN;
      const prepOk = Number.isFinite(prepM) && prepM > 0;
      const cookOk = Number.isFinite(cookM) && cookM > 0;
      return {
        id: row.id as string,
        creatorName: (row?.author?.display_name as string | null) ?? "Community",
        creatorImage:
          (row?.author?.avatar_url as string | null) ??
          NEUTRAL_AVATAR_DATA_URI,
        // 2026-04-26 polish: render-time normalisation for legacy
        // ALL-CAPS rows (publisher schema.org name fields). The helper is
        // a no-op for any title that already contains lowercase, so
        // mixed-case authored titles pass through untouched.
        title: normalizeRecipeTitle(row.title as string | null | undefined),
        image: (row.image_url as string | null) ?? DEFAULT_UPLOADED_RECIPE_IMAGE,
        servings: (row.servings as number) ?? 1,
        calories: (row.calories as number) ?? 0,
        protein: (row.protein as number) ?? 0,
        carbs: (row.carbs as number) ?? 0,
        fat: (row.fat as number) ?? 0,
        fiberG: Math.max(0, Number((row as { fiber_g?: number }).fiber_g ?? 0) || 0),
        isVerified: Boolean(row.is_verified),
        creatorCalories: (row.creator_calories as number | null) ?? undefined,
        savedCount: 0,
        isSaved: false,
        feedCreatedAt: row.created_at as string,
        authorId: (row.author_id as string | null) ?? null,
        creatorId: (row.creator_id as string | null) ?? null,
        mealSlots: mealPlannerSlotsFromMealType((row as { meal_type?: string[] | null }).meal_type),
        prepTimeMin: prepOk ? Math.round(prepM) : null,
        cookTimeMin: cookOk ? Math.round(cookM) : null,
        prepTime: formatRecipeMinutes(prepOk ? prepM : null),
        cookTime: formatRecipeMinutes(cookOk ? cookM : null),
        allergens: Array.isArray((row as { allergens?: string[] }).allergens)
          ? ((row as { allergens?: string[] }).allergens as string[])
          : [],
        // GW-02 (2026-04-28): pull `dietary_flags` so the Library
        // Vegetarian filter can prefer the structured signal over
        // the title-keyword heuristic.
        dietaryFlags: Array.isArray((row as { dietary_flags?: unknown[] }).dietary_flags)
          ? ((row as { dietary_flags?: unknown[] }).dietary_flags as string[])
          : [],
      };
    });

    let enriched = mapped;
    try {
      const counts = await fetchPublicRecipeSaveCounts(supabase, mapped.map((r) => r.id));
      enriched = mapped.map((r) => ({ ...r, savedCount: counts.get(r.id) ?? 0 }));
    } catch (e) {
      console.warn("[refreshDiscoverRecipes] public save counts failed:", e);
    }

    setUploadedRecipes(enriched);
  }, []);

  useEffect(() => {
    if (!authedUserId) return;
    void refreshDiscoverRecipes();
  }, [authedUserId, refreshDiscoverRecipes]);

  const refreshMyLibraryRecipes = useCallback(async () => {
    if (!authedUserId) return;
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, title, image_url, servings, is_verified, creator_calories, calories, protein, carbs, fat, fiber_g, created_at, author_id, creator_id, meal_type, published, source_name, source_url, prep_time_min, cook_time_min, allergens, dietary_flags",
      )
      .eq("author_id", authedUserId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return;
    const mapped: RecipeCard[] = (data ?? []).map((row: any) => {
      const importAttribution = (row.source_name as string | null)?.trim() ?? "";
      const prepM = row.prep_time_min != null ? Number(row.prep_time_min) : NaN;
      const cookM = row.cook_time_min != null ? Number(row.cook_time_min) : NaN;
      const prepOk = Number.isFinite(prepM) && prepM > 0;
      const cookOk = Number.isFinite(cookM) && cookM > 0;
      return {
        id: row.id as string,
        creatorName: importAttribution || profileDisplayName || "You",
        creatorImage:
          NEUTRAL_AVATAR_DATA_URI,
        // 2026-04-26 polish: render-time normalisation for legacy
        // ALL-CAPS rows (publisher schema.org name fields). The helper is
        // a no-op for any title that already contains lowercase, so
        // mixed-case authored titles pass through untouched.
        title: normalizeRecipeTitle(row.title as string | null | undefined),
        image: (row.image_url as string | null) ?? DEFAULT_UPLOADED_RECIPE_IMAGE,
        servings: (row.servings as number) ?? 1,
        calories: (row.calories as number) ?? 0,
        protein: (row.protein as number) ?? 0,
        carbs: (row.carbs as number) ?? 0,
        fat: (row.fat as number) ?? 0,
        fiberG: Math.max(0, Number((row as { fiber_g?: number }).fiber_g ?? 0) || 0),
        isVerified: Boolean(row.is_verified),
        creatorCalories: (row.creator_calories as number | null) ?? undefined,
        savedCount: 0,
        isSaved: false,
        feedCreatedAt: row.created_at as string,
        authorId: (row.author_id as string | null) ?? null,
        creatorId: (row.creator_id as string | null) ?? null,
        mealSlots: mealPlannerSlotsFromMealType((row as { meal_type?: string[] | null }).meal_type),
        isPublished: Boolean((row as { published?: boolean | null }).published),
        // F-7 (2026-04-18): expose `source_url` so Library can
        // distinguish imported (`source_url` set) vs created drafts —
        // parity with mobile `useSavedLibraryRecipes` / `entryKindForCard`.
        sourceUrl: (row as { source_url?: string | null }).source_url ?? null,
        prepTimeMin: prepOk ? Math.round(prepM) : null,
        cookTimeMin: cookOk ? Math.round(cookM) : null,
        prepTime: formatRecipeMinutes(prepOk ? prepM : null),
        cookTime: formatRecipeMinutes(cookOk ? cookM : null),
        allergens: Array.isArray((row as { allergens?: string[] }).allergens)
          ? ((row as { allergens?: string[] }).allergens as string[])
          : [],
        // GW-02 (2026-04-28): see refreshDiscoverRecipes mapper.
        dietaryFlags: Array.isArray((row as { dietary_flags?: unknown[] }).dietary_flags)
          ? ((row as { dietary_flags?: unknown[] }).dietary_flags as string[])
          : [],
      };
    });
    setMyLibraryRecipes(mapped);
  }, [authedUserId, profileDisplayName]);

  useEffect(() => {
    if (!authedUserId) return;
    void refreshMyLibraryRecipes();
  }, [authedUserId, refreshMyLibraryRecipes]);

  const duplicateRecipeToCreatedDraft = useCallback(
    async (sourceRecipeId: string): Promise<string | null> => {
      if (!authedUserId) {
        toast.error("Please sign in again.");
        return null;
      }
      const { data: src, error: srcErr } = await supabase
        .from("recipes")
        .select("title, description, instructions, servings, prep_time_min, cook_time_min, meal_type, dietary, image_url")
        .eq("id", sourceRecipeId)
        .maybeSingle();
      if (srcErr || !src) {
        toast.error(srcErr?.message ?? "Could not load recipe.");
        return null;
      }
      const { data: ingRows, error: ingErr } = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, fatsecret_food_id, confidence, is_verified, source")
        .eq("recipe_id", sourceRecipeId)
        .order("created_at", { ascending: true });
      if (ingErr) {
        toast.error(ingErr.message);
        return null;
      }

      const title = String((src as any).title ?? "Untitled").trim() || "Untitled";
      const nextTitle = `My version: ${title}`;

      const { data: inserted, error: insErr } = await supabase
        .from("recipes")
        .insert({
          author_id: authedUserId,
          title: nextTitle,
          description: (src as any).description ?? null,
          instructions: (src as any).instructions ?? "",
          image_url: (src as any).image_url ?? null,
          servings: (src as any).servings ?? 1,
          prep_time_min: (src as any).prep_time_min ?? null,
          cook_time_min: (src as any).cook_time_min ?? null,
          meal_type: (src as any).meal_type ?? null,
          dietary: (src as any).dietary ?? [],
          published: false,
          is_verified: false,
          verified_source: null,
          verified_confidence: null,
          verified_at: null,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber_g: 0,
          sugar_g: 0,
          sodium_mg: 0,
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        toast.error(insErr?.message ?? "Could not duplicate recipe.");
        return null;
      }
      const newId = String((inserted as any).id);

      const inserts = (ingRows ?? []).map((r: any) => ({
        recipe_id: newId,
        ingredient_id: null,
        name: String(r.name ?? ""),
        amount: r.amount ?? null,
        unit: r.unit ?? null,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        carbs: r.carbs ?? 0,
        fat: r.fat ?? 0,
        fiber_g: r.fiber_g ?? 0,
        sugar_g: r.sugar_g ?? 0,
        sodium_mg: r.sodium_mg ?? 0,
        fatsecret_food_id: r.fatsecret_food_id ?? null,
        confidence: r.confidence ?? null,
        is_verified: Boolean(r.is_verified),
        source: r.source ?? null,
      }));
      if (inserts.length > 0) {
        const { error: insIngErr } = await supabase.from("recipe_ingredients").insert(inserts);
        if (insIngErr) {
          toast.error(insIngErr.message);
          return null;
        }
      }

      // Inline the "ensure in library" behavior here to avoid ordering issues with hook declarations.
      const iso = new Date().toISOString();
      setSavedRecipeIds((prev) => (prev.includes(newId) ? prev : [newId, ...prev]));
      setSavedAtById((prev) => ({ ...prev, [newId]: prev[newId] ?? iso }));
      setLibraryEntryKindByRecipeId((prev) => ({ ...prev, [newId]: "created" }));
      setSavedRecipeMetaById((prev) => ({
        ...prev,
        [newId]: {
          title: nextTitle,
          image: (src as any).image_url ?? null,
          creatorName: profileDisplayName ?? "You",
          creatorImage: NEUTRAL_AVATAR_DATA_URI,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
      }));
      await refreshMyLibraryRecipes();
      toast.success("Created your own draft version");
      return newId;
    },
    [authedUserId, refreshMyLibraryRecipes, profileDisplayName],
  );

  const generateMealPlan = useCallback(
    async (options?: {
      targetsOverride?: Partial<PlannerTargets>;
      days?: number;
      slots?: string[];
      /**
       * ENG-790 — where recipes are drawn from. Provided only by the
       * `plan_source_selector`-gated UI; when omitted (flag off / legacy
       * callers) the function keeps the saved-only behaviour with the hard
       * 0-saved gate. When provided, the pool + gate run off the shared
       * `selectPlanPool` / `canGenerateFromSource` helper (mobile parity).
       */
      source?: PlanSourceMode;
    }) => {
      const { generatePlanFromLibrary } = await import("../lib/planning/generateMealPlan.ts");
      setIsGeneratingPlan(true);
      try {
        const o = options?.targetsOverride ?? {};
        const targets: PlannerTargets = {
          calories: o.calories ?? nutritionTargets.calories,
          protein: o.protein ?? nutritionTargets.protein,
          carbs: o.carbs ?? nutritionTargets.carbs,
          fat: o.fat ?? nutritionTargets.fat,
          fiber: o.fiber ?? nutritionTargets.fiber,
          calorieBandPct: o.calorieBandPct ?? DEFAULT_PLANNER_BANDS.calorieBandPct,
          carbFatBandPct: o.carbFatBandPct ?? DEFAULT_PLANNER_BANDS.carbFatBandPct,
        };
        const days = options?.days ?? 1;
        const savedRecipes = savedRecipesForPlanning({
          savedRecipeIds,
          myLibraryRecipes,
          uploadedRecipes,
        });
        if (savedRecipes.length < savedRecipeIds.length) {
          console.warn(
            "[generateMealPlan] Some saved recipes could not be resolved for planning:",
            savedRecipeIds.length - savedRecipes.length,
          );
        }
        // ENG-790 — pool selection. `source` provided → draw from the
        // chosen source (library / library+discovery / discovery) via the
        // shared helper, de-duping discover against saved. `source`
        // omitted → legacy saved-only path with the hard 0-saved gate.
        // The discover pool mirrors the `discoverRecipes` memo below:
        // curated seeds + community uploads.
        let pool: RecipeCard[];
        if (options?.source) {
          const discoverPool = [
            ...(seedsToRecipeCards(SEED_RECIPES_V2) as unknown as RecipeCard[]),
            ...uploadedRecipes,
          ];
          const savedIds = new Set(savedRecipes.map((r) => r.id));
          const discoverCount = discoverPool.filter((r) => !savedIds.has(r.id)).length;
          if (
            !canGenerateFromSource(options.source, {
              libraryCount: savedRecipes.length,
              discoverCount,
            })
          ) {
            toast.error(
              options.source === "library"
                ? "Save at least one recipe to plan from your library."
                : "No recipes available to plan from right now.",
            );
            return;
          }
          pool = selectPlanPool(options.source, {
            library: savedRecipes,
            discover: discoverPool,
          });
        } else {
          if (savedRecipes.length === 0) {
            toast.error("Save at least one recipe from Discover (or your Library) to generate a macro-aware plan.");
            return;
          }
          pool = savedRecipes;
        }
        // T14 (full-sweep 2026-04-24): instrument generation duration +
        // pool size so we can set the sampler cap from real data and
        // compare web vs mobile perf. `generatePlanFromLibrary` is
        // already sync on web — the durationMs captures the sampler cost.
        const generateStartMs = Date.now();
        const rawPlan = generatePlanFromLibrary({
          savedRecipes: pool,
          targets,
          days,
          ...(options?.slots && options.slots.length > 0
            ? { slots: options.slots }
            : {}),
        });
        // F2-K (audit 2026-04-28): post-process the plan with the
        // leftover-distribution pass, mirroring the mobile flow at
        // `apps/mobile/app/(tabs)/planner.tsx:1361-1376`. A recipe with
        // `servings >= 2` produces (servings - 1) leftover entries that
        // fill compatible empty slots on subsequent days. This was a
        // real cross-platform divergence — mobile users got leftovers
        // distributed automatically; web users got every slot freshly
        // sampled, which on small recipe pools produced repetition
        // and increased the chance of duplicate-ingredient shopping.
        const { distributeLeftovers } = await import("../lib/nutrition/leftoversPlanner.ts");
        const recipesByRef: Record<string, { servings: number } | undefined> = {};
        for (const r of pool) {
          if (typeof r.servings === "number" && r.servings > 0) {
            recipesByRef[r.id] = { servings: r.servings };
          }
        }
        const { plan, leftoverCount } = distributeLeftovers(rawPlan, recipesByRef);
        const generateDurationMs = Date.now() - generateStartMs;
        setMealPlan(plan);
        if (leftoverCount > 0) {
          // Telemetry only — no user toast (mobile parity). The
          // visible signal is the Leftover badge on the row itself.
        }
        toast.success("Meal plan generated");
        if (notificationPrefs.mealReminders) {
          pushNotification({
            kind: "meal_plan_ready",
            title: "Meal plan is ready",
            body: "Your plan has been updated. You can swap meals or start logging.",
          });
        }
        track(AnalyticsEvents.meal_plan_generated, {
          days,
          durationMs: generateDurationMs,
          poolSize: pool.length,
          platform: "web",
        });
      } finally {
        setIsGeneratingPlan(false);
      }
    },
    [
      nutritionTargets.calories,
      nutritionTargets.protein,
      nutritionTargets.carbs,
      nutritionTargets.fat,
      notificationPrefs.mealReminders,
      pushNotification,
      savedRecipeIds,
      uploadedRecipes,
      myLibraryRecipes,
      setMealPlan,
    ],
  );

  const generateShoppingListFromPlan = useCallback(async () => {
    const planningPool = savedRecipesForPlanning({
      savedRecipeIds,
      myLibraryRecipes,
      uploadedRecipes,
    });
    const titleToId = (title: string) => {
      return planningPool.find((x) => x.title === title)?.id ?? null;
    };
    const entries = (mealPlan ?? [])
      .flatMap((d) => d.meals)
      .filter(
        (m) =>
          m.recipeTitle &&
          !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }) &&
          // ENG-1134 — leftover slots are planned portions of the same recipe;
          // each contributes portion÷servings (skip only duplicated parent buys).
          titleToId(m.recipeTitle),
      )
      .map((m) => {
        const recipeId = titleToId(m.recipeTitle);
        const servings = recipeId
          ? planningPool.find((r) => r.id === recipeId)?.servings
          : undefined;
        return {
          title: m.recipeTitle,
          multiplier: shoppingListIngredientMultiplier(m.portionMultiplier, servings),
        };
      });

    const recipeIds = [
      ...new Set(
        entries
          .map((e) => titleToId(e.title))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const ingredientsByRecipeId = new Map<string, RecipeIngredientRow[]>();
    if (recipeIds.length > 0) {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name, amount, unit")
        .in("recipe_id", recipeIds)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Could not load ingredients for your planned recipes.");
      } else {
        for (const row of data ?? []) {
          const recipeId = String((row as { recipe_id: string }).recipe_id ?? "");
          if (!recipeId) continue;
          const bucket = ingredientsByRecipeId.get(recipeId) ?? [];
          bucket.push({
            name: String((row as { name: string }).name ?? ""),
            amount:
              (row as { amount: number | null }).amount != null
                ? String((row as { amount: number | null }).amount)
                : "",
            unit: String((row as { unit: string | null }).unit ?? ""),
          });
          ingredientsByRecipeId.set(recipeId, bucket);
        }
      }
    }

    const list = generateShoppingListFromRecipeEntries({
      entries,
      recipeTitleToId: titleToId,
      ingredientsByRecipeId,
    });
    const filtered = filterShoppingItemsByPantry(list, pantryStaples);
    setShoppingItems(filtered);
    setShoppingListSourceFingerprint(fingerprintMealPlanForShopping(mealPlan));
    let planAnchor = startDateForOffset(new Date(), 0);
    if (authedUserId) {
      const { data: anchorRow } = await supabase
        .from("meal_plan_days")
        .select("start_date")
        .eq("user_id", authedUserId)
        .eq("slot_id", cloudSlotIdFromLocal(activeMealPlanSlotIdRef.current))
        .order("day", { ascending: true })
        .limit(1)
        .maybeSingle();
      const raw = (anchorRow as { start_date?: string } | null)?.start_date;
      if (typeof raw === "string" && raw.length >= 10) {
        planAnchor = raw.slice(0, 10);
      }
    }
    setShoppingListPlanStartDate(planAnchor);
    toast.success("Shopping list generated");
    track(AnalyticsEvents.shopping_list_generated, { itemCount: filtered.length });

    // G-2 (TestFlight `ALU8hrB1I9Sn4ysqoR_ocEs`, 2026-04-19): on
    // regenerate, purge the old `shopping_items` rows *before*
    // writing the fresh list — otherwise rows tied to recipes that
    // are no longer in the plan survive forever and re-hydrate on
    // next cold start from the DB load in `useShoppingListState`.
    // Persist in the background so the Shopping tab updates immediately.
    if (authedUserId && shoppingScope) {
      void (async () => {
        let delQ = supabase.from("shopping_items").delete();
        if (shoppingScope.kind === "household") {
          delQ = delQ.eq("household_id", shoppingScope.householdId);
        } else {
          delQ = delQ.eq("user_id", authedUserId).is("household_id", null);
        }
        const { error: delErr } = await delQ;
        if (delErr) {
          toast.error(syncFailedRetryMessage("shopping list", delErr.message ?? ""));
          return;
        }
        if (filtered.length === 0) return;
        const stamp = shoppingScopeInsertStamp(shoppingScope);
        const inserts = filtered.map((item) => ({
          user_id: stamp.user_id,
          household_id: stamp.household_id,
          name: item.name,
          amount: item.amount,
          unit: item.unit,
          category: item.category,
          checked: item.checked,
          source: item.from,
        }));
        for (let i = 0; i < inserts.length; i += 50) {
          const { error: insErr } = await supabase
            .from("shopping_items")
            .insert(inserts.slice(i, i + 50));
          if (insErr) {
            toast.error(syncFailedRetryMessage("shopping list", insErr.message ?? ""));
            return;
          }
        }
      })();
    }
  }, [mealPlan, savedRecipeIds, myLibraryRecipes, uploadedRecipes, authedUserId, shoppingScope, setShoppingItems, pantryStaples]);

  const savePantryStaples = useCallback(
    async (staples: readonly string[]) => {
      const normalized = parsePantryStaples(staples);
      setPantryStaples(normalized);
      if (!authedUserId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ pantry_staples: normalized })
        .eq("id", authedUserId);
      if (error) {
        toast.error(syncFailedRetryMessage("pantry staples", error.message ?? ""));
      }
    },
    [authedUserId],
  );

  // Sync DB-backed saves (Phase 0). Other state remains local for now.
  useEffect(() => {
    if (!authedUserId || !dbSavesEnabled) {
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("saves")
        .select("recipe_id, created_at")
        .order("created_at", { ascending: false });
      if (cancelled) {
        return;
      }
      if (error) {
        // If schema cache doesn't include the table yet, fall back to localStorage so the app stays usable.
        const msg = error.message ?? "";
        if (looksLikeMissingTableError(msg)) {
          setDbSavesEnabled(false);
          if (!dbSavesWarned) {
            setDbSavesWarned(true);
            toast.warning(syncDisabledBecauseSchemaMessage("Saved recipes"));
          }
          return;
        }
        toast.error(syncFailedRetryMessage("saved recipes", msg));
        return;
      }
      const rawIds = (data ?? []).map((r) => r.recipe_id as string);
      const savedAt: Record<string, string> = {};
      for (const r of data ?? []) {
        savedAt[r.recipe_id as string] = (r.created_at as string) ?? new Date().toISOString();
      }

      // F-8 (TestFlight `AAHS7CjeXNC-mwzyLgWFuKQ`, 2026-04-18): drop
      // saves that reference a recipe that no longer exists. The
      // `saves` table is not FK-cascade on all historical projects,
      // so deleting a recipe can leave orphan rows. Rendering those
      // produced "Unavailable" cards ("defaults to recipes that don't
      // exist" in the tester's words). One short query; silent log
      // only when we actually find orphans.
      let ids = rawIds;
      if (rawIds.length > 0) {
        const { data: live, error: liveErr } = await supabase
          .from("recipes")
          .select("id")
          .in("id", rawIds);
        if (!liveErr && Array.isArray(live)) {
          const { validIds, orphanIds } = filterOrphanSaves(
            rawIds,
            live.map((r) => r.id as string),
          );
          ids = validIds;
          if (orphanIds.length > 0) {
            console.info("[saves] dropping orphan save rows:", orphanIds.length);
            // Evict cached meta for the orphan ids so the snapshot
            // store doesn't resurrect them on next cold start.
            setSavedRecipeMetaById((prev) => {
              if (orphanIds.every((id) => !(id in prev))) return prev;
              const next = { ...prev };
              for (const id of orphanIds) delete next[id];
              return next;
            });
            for (const id of orphanIds) delete savedAt[id];
            void supabase
              .from("saves")
              .delete()
              .eq("user_id", authedUserId)
              .in("recipe_id", orphanIds);
          }
        }
      }

      setSavedRecipeIds(ids);
      setSavedAtById(savedAt);
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbSavesEnabled, dbSavesWarned]);

  // Persist meal plan to Supabase via T15 atomic RPC (debounced).
  useEffect(() => {
    if (!authedUserId || !dbMealPlanEnabled || !mealPlan) return;
    const t = setTimeout(async () => {
      // T7 (2026-04-24) anchor: web planner has no next-week chip yet,
      // so every save anchors to today. T15 (2026-04-24) atomic save:
      // single RPC replaces the previous DELETE + bulk-INSERT pair so
      // a network drop mid-save can no longer leave an orphaned half.
      const webStartDate = (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      })();
      const planPayload = mealPlan.map((dp) => ({
        day: dp.day,
        meals: dp.meals.map((m, idx) => ({
          slot_index: idx,
          name: m.name,
          recipe_title: m.recipeTitle,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          portion_multiplier: m.portionMultiplier ?? 1,
          is_placeholder: m.isPlaceholder ?? false,
        })),
      }));
      const { error } = await supabase.rpc("save_meal_plan", {
        p_slot_id: cloudSlotIdFromLocal(activeMealPlanSlotIdRef.current),
        p_start_date: webStartDate,
        p_plan: planPayload,
      } as never);

      if (error) {
        const msg = error.message ?? "";
        // Schema refactor Phase 3 (2026-05-11) — legacy JSONB upsert
        // fallback removed (table dropped 2026-04-21; RPC has been in
        // production for weeks). 42883 / missing-table errors here
        // are now hard failures the user needs to know about.
        if (
          (error as { code?: string }).code === "42883" ||
          looksLikeMissingTableError(msg)
        ) {
          setDbMealPlanEnabled(false);
          if (!dbMealPlanWarned) {
            setDbMealPlanWarned(true);
            toast.warning(syncDisabledBecauseSchemaMessage("Meal plan"));
          }
          return;
        }
        console.error("[mealPlan] save_meal_plan failed:", msg);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, dbMealPlanEnabled, dbMealPlanWarned, mealPlan]);

  // ENG-1130 — sync named slot registry (ids, names, active) to profiles.
  useEffect(() => {
    if (!authedUserId || !mealPlanSlotsCloudLoadedRef.current) return;
    const t = setTimeout(async () => {
      const payload = metadataFromSlots(
        mealPlanSlotsRef.current,
        activeMealPlanSlotIdRef.current,
      );
      const { error } = await supabase
        .from("profiles")
        .update({ meal_plan_slots: payload })
        .eq("id", authedUserId);
      if (error) {
        const msg = error.message ?? "";
        if (!looksLikeMissingTableError(msg)) {
          console.error("[mealPlanSlots] profile metadata sync failed:", msg);
        }
      }
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, mealPlanSlots, activeMealPlanSlotId]);

  const extraWaterMlForSelectedDay = extraWaterByDay[selectedDateKey] ?? 0;
  const extraCaffeineMgForSelectedDay = extraCaffeineByDay[selectedDateKey] ?? 0;
  const extraAlcoholGForSelectedDay = extraAlcoholGByDay[selectedDateKey] ?? 0;

  const activityBurnForSelectedDay = activityBurnByDay[selectedDateKey] ?? activityBurnKcal;

  const setActivityBurnForSelectedDay = useCallback(
    (kcal: number) => {
      const v = Math.max(0, Math.round(kcal));
      setActivityBurnByDay((prev) => ({ ...prev, [selectedDateKey]: v }));
    },
    [selectedDateKey],
  );

  const addWaterMlForSelectedDay = useCallback(
    (ml: number) => {
      const add = Math.max(0, Math.round(ml));
      if (add === 0) return;
      setExtraWaterByDay((prev) => {
        const updated = { ...prev, [selectedDateKey]: (prev[selectedDateKey] ?? 0) + add };
        // Persist to Supabase immediately (don't rely on debounce alone,
        // which gets cancelled if the user switches views within 1.2s).
        if (authedUserId && waterActivityLoadedRef.current) {
          void supabase
            .from("profiles")
            .update({ extra_water_by_day: updated })
            .eq("id", authedUserId);
        }
        return updated;
      });
      track(AnalyticsEvents.hydration_logged, {
        type: "water",
        amount: add,
        unit: "ml",
        preset: null,
        // L6 G6 (2026-04-18) — explicit amount_ml + via so dashboards
        // don't have to parse (amount, unit) to know how much water
        // was logged. The only caller on web is the quick-chip path
        // (HydrationStimulantsCard + TodayDashboardMacroTiles); the
        // manual-entry form logs `waterMl` via the meal row instead,
        // which lands in `food_logged` not `hydration_logged`.
        amount_ml: add,
        via: "quick_chip",
      });
    },
    [selectedDateKey, authedUserId],
  );

  const addCaffeineMgForSelectedDay = useCallback(
    (mg: number, preset: string | null = null) => {
      const add = Math.max(0, Math.round(mg));
      if (add === 0) return;
      setExtraCaffeineByDay((prev) => {
        const updated = { ...prev, [selectedDateKey]: (prev[selectedDateKey] ?? 0) + add };
        if (authedUserId && waterActivityLoadedRef.current) {
          void supabase
            .from("profiles")
            .update({ extra_caffeine_by_day: updated })
            .eq("id", authedUserId);
        }
        return updated;
      });
      track(AnalyticsEvents.stimulant_logged, {
        type: "caffeine",
        amount: add,
        unit: "mg",
        preset: preset ?? null,
        // L6 G6 (2026-04-18) — explicit kind + via + amount_mg_or_g.
        kind: "caffeine",
        amount_mg_or_g: add,
        via: preset ? "quick_chip" : "manual",
      });
    },
    [selectedDateKey, authedUserId],
  );

  const addAlcoholGForSelectedDay = useCallback(
    (grams: number, preset: string | null = null) => {
      const add = Math.max(0, Math.round(grams));
      if (add === 0) return;
      setExtraAlcoholGByDay((prev) => {
        const updated = { ...prev, [selectedDateKey]: (prev[selectedDateKey] ?? 0) + add };
        if (authedUserId && waterActivityLoadedRef.current) {
          void supabase
            .from("profiles")
            .update({ extra_alcohol_g_by_day: updated })
            .eq("id", authedUserId);
        }
        return updated;
      });
      track(AnalyticsEvents.stimulant_logged, {
        type: "alcohol",
        amount: add,
        unit: "g",
        preset: preset ?? null,
        // L6 G6 (2026-04-18) — explicit kind + via + amount_mg_or_g.
        kind: "alcohol",
        amount_mg_or_g: add,
        via: preset ? "quick_chip" : "manual",
      });
    },
    [selectedDateKey, authedUserId],
  );

  /**
   * Reset today's value for one of the three hydration rows. Leaves the
   * other days + the other kinds untouched. Fires an analytics event with
   * `amount: 0` so the reset is observable in funnels.
   */
  const resetHydrationStimulantsForDay = useCallback(
    (dayKey: string, kind: "water" | "caffeine" | "alcohol") => {
      if (!dayKey) return;
      const clearColumn =
        kind === "water"
          ? "extra_water_by_day"
          : kind === "caffeine"
          ? "extra_caffeine_by_day"
          : "extra_alcohol_g_by_day";

      if (kind === "water") {
        setExtraWaterByDay((prev) => {
          if (prev[dayKey] == null) return prev;
          const next = { ...prev };
          delete next[dayKey];
          if (authedUserId && waterActivityLoadedRef.current) {
            void supabase.from("profiles").update({ [clearColumn]: next }).eq("id", authedUserId);
          }
          return next;
        });
      } else if (kind === "caffeine") {
        setExtraCaffeineByDay((prev) => {
          if (prev[dayKey] == null) return prev;
          const next = { ...prev };
          delete next[dayKey];
          if (authedUserId && waterActivityLoadedRef.current) {
            void supabase.from("profiles").update({ [clearColumn]: next }).eq("id", authedUserId);
          }
          return next;
        });
      } else {
        setExtraAlcoholGByDay((prev) => {
          if (prev[dayKey] == null) return prev;
          const next = { ...prev };
          delete next[dayKey];
          if (authedUserId && waterActivityLoadedRef.current) {
            void supabase.from("profiles").update({ [clearColumn]: next }).eq("id", authedUserId);
          }
          return next;
        });
      }

      // L6 G6 (2026-04-18) — reset fires the same event with the
      // enriched payload. `via: "manual"` because reset is always a
      // deliberate menu action, never a quick chip. `amount_ml` /
      // `amount_mg_or_g` stay 0 so a reset is a distinct row in
      // funnels without a dedicated event name.
      if (kind === "water") {
        track(AnalyticsEvents.hydration_logged, {
          type: "water",
          amount: 0,
          unit: "ml",
          preset: "reset",
          amount_ml: 0,
          via: "manual",
        });
      } else {
        track(AnalyticsEvents.stimulant_logged, {
          type: kind,
          amount: 0,
          unit: kind === "caffeine" ? "mg" : "g",
          preset: "reset",
          kind,
          amount_mg_or_g: 0,
          via: "manual",
        });
      }
    },
    [authedUserId],
  );

  // Sync water, caffeine, alcohol, and activity burn data to Supabase (debounced).
  // Skipped until the initial Supabase load resolves to avoid overwriting
  // server data with stale localStorage values on a new device.
  // Debounce matched to 300 ms per spec — tight enough that a burst of
  // quick-add chips doesn't fan out individual writes (the inline per-action
  // writes above cover instant persistence on nav-away), loose enough that
  // we never race with React batching.
  useEffect(() => {
    if (!authedUserId || !waterActivityLoadedRef.current) return;
    const t = setTimeout(() => {
      void supabase
        .from("profiles")
        .update({
          extra_water_by_day: extraWaterByDay,
          extra_caffeine_by_day: extraCaffeineByDay,
          extra_alcohol_g_by_day: extraAlcoholGByDay,
          activity_burn_by_day: activityBurnByDay,
        })
        .eq("id", authedUserId);
    }, 300);
    return () => clearTimeout(t);
  }, [authedUserId, extraWaterByDay, extraCaffeineByDay, extraAlcoholGByDay, activityBurnByDay]);

  // Load water, caffeine, alcohol, targets & activity burn from Supabase on mount.
  // Sets waterActivityLoadedRef so the debounced write-back only starts after
  // server state is known (prevents stale localStorage from clobbering Supabase).
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select(
        "extra_water_by_day, extra_caffeine_by_day, extra_alcohol_g_by_day, target_caffeine_mg, target_alcohol_g_weekly, activity_burn_by_day, workouts_by_day, basal_burn_by_day",
      )
      .eq("id", authedUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // Schema-missing fallback: if the migration hasn't landed yet, the
        // select with new columns errors. Retry with the legacy subset so
        // the profile still loads and quick-add water keeps working.
        if (error) {
          void supabase
            .from("profiles")
            .select("extra_water_by_day, activity_burn_by_day, workouts_by_day, basal_burn_by_day")
            .eq("id", authedUserId)
            .maybeSingle()
            .then(({ data: legacy }) => {
              if (cancelled) return;
              if (legacy?.extra_water_by_day && typeof legacy.extra_water_by_day === "object") {
                setExtraWaterByDay(legacy.extra_water_by_day as Record<string, number>);
              }
              if (legacy?.activity_burn_by_day && typeof legacy.activity_burn_by_day === "object") {
                setActivityBurnByDay(legacy.activity_burn_by_day as Record<string, number>);
              }
              if (legacy?.workouts_by_day && typeof legacy.workouts_by_day === "object" && !Array.isArray(legacy.workouts_by_day)) {
                setWorkoutsByDay(legacy.workouts_by_day as Record<string, Array<{ type: string; minutes: number; calories: number; source: string }>>);
              }
              if (legacy?.basal_burn_by_day && typeof legacy.basal_burn_by_day === "object") {
                setBasalBurnByDay(legacy.basal_burn_by_day as Record<string, number>);
              }
              waterActivityLoadedRef.current = true;
            });
          return;
        }
        if (data?.extra_water_by_day && typeof data.extra_water_by_day === "object") {
          setExtraWaterByDay(data.extra_water_by_day as Record<string, number>);
        }
        if (data?.extra_caffeine_by_day && typeof data.extra_caffeine_by_day === "object") {
          setExtraCaffeineByDay(data.extra_caffeine_by_day as Record<string, number>);
        }
        if (data?.extra_alcohol_g_by_day && typeof data.extra_alcohol_g_by_day === "object") {
          setExtraAlcoholGByDay(data.extra_alcohol_g_by_day as Record<string, number>);
        }
        const caf = (data as { target_caffeine_mg?: number | null } | null)?.target_caffeine_mg;
        if (typeof caf === "number" && Number.isFinite(caf) && caf >= 0) {
          setTargetCaffeineMg(Math.round(caf));
        }
        const alc = (data as { target_alcohol_g_weekly?: number | null } | null)?.target_alcohol_g_weekly;
        if (typeof alc === "number" && Number.isFinite(alc) && alc >= 0) {
          setTargetAlcoholGWeekly(Math.round(alc));
        }
        if (data?.activity_burn_by_day && typeof data.activity_burn_by_day === "object") {
          setActivityBurnByDay(data.activity_burn_by_day as Record<string, number>);
        }
        if (data?.workouts_by_day && typeof data.workouts_by_day === "object" && !Array.isArray(data.workouts_by_day)) {
          setWorkoutsByDay(data.workouts_by_day as Record<string, Array<{ type: string; minutes: number; calories: number; source: string }>>);
        }
        if (data?.basal_burn_by_day && typeof data.basal_burn_by_day === "object") {
          setBasalBurnByDay(data.basal_burn_by_day as Record<string, number>);
        }
        waterActivityLoadedRef.current = true;
      });
    return () => { cancelled = true; };
  }, [authedUserId]);

  usePersistLocalAppSnapshot({
    savedRecipeIds,
    savedAtById,
    savedRecipeMetaById,
    libraryEntryKindByRecipeId,
    shoppingItems,
    shoppingListSourceFingerprint,
    shoppingListPlanStartDate,
    pantryStaples,
    nutritionByDay,
    mealPlan,
    mealPlanSlots,
    activeMealPlanSlotId,
    nutritionTargets,
    extraWaterByDay,
    activityBurnKcal,
    activityBurnByDay,
    notificationsInbox,
    notificationPrefs,
  });

  const isRecipeSaved = useCallback(
    (recipeId: string) => savedRecipeIds.includes(recipeId),
    [savedRecipeIds],
  );

  const toggleSaveRecipe = useCallback(
    (recipeId: string, tier: UserTier, kind?: LibraryEntryKind): boolean => {
      const exists = savedRecipeIds.includes(recipeId);
      if (exists) {
        // optimistic
        setSavedRecipeIds((prev) => prev.filter((id) => id !== recipeId));
        setSavedAtById((prev) => {
          const next = { ...prev };
          delete next[recipeId];
          return next;
        });
        setLibraryEntryKindByRecipeId((prev) => {
          const next = { ...prev };
          delete next[recipeId];
          return next;
        });
        setSavedRecipeMetaById((prev) => {
          const next = { ...prev };
          delete next[recipeId];
          return next;
        });
        if (authedUserId && dbSavesEnabled) {
          supabase
            .from("saves")
            .delete()
            .eq("user_id", authedUserId)
            .eq("recipe_id", recipeId)
            .then(({ error }) => {
              if (error) {
                const msg = error.message ?? "";
                if (looksLikeMissingTableError(msg)) {
                  setDbSavesEnabled(false);
                  if (!dbSavesWarned) {
                    setDbSavesWarned(true);
                    toast.warning(syncDisabledBecauseSchemaMessage("Saved recipes"));
                  }
                  return;
                }
                toast.error(syncFailedRetryMessage("library update", error.message ?? ""));
              } else {
                toast.success("Removed from library");
              }
            });
        } else {
          toast.success("Removed from library");
        }
        return false;
      }
      // Enforce free-tier save limit.
      if (tier === "free" && savedRecipeIds.length >= FREE_SAVE_LIMIT) {
        toast.error(`Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes.`, {
          action: { label: "See plans", onClick: () => { window.location.href = "/pricing"; } },
        });
        return false;
      }
      const iso = new Date().toISOString();
      setSavedRecipeIds((prev) => [recipeId, ...prev.filter((id) => id !== recipeId)]);
      setSavedAtById((prev) => ({ ...prev, [recipeId]: iso }));
      setLibraryEntryKindByRecipeId((prev) => ({ ...prev, [recipeId]: kind ?? "saved" }));
      setSavedRecipeMetaById((prev) => {
        const r = uploadedRecipes.find((r) => r.id === recipeId) ?? myLibraryRecipes.find((r) => r.id === recipeId);
        if (!r) return prev;
        return {
          ...prev,
          [recipeId]: {
            title: r.title,
            image: r.image,
            creatorName: r.creatorName,
            creatorImage: r.creatorImage,
            calories: r.calories,
            protein: r.protein,
            carbs: r.carbs,
            fat: r.fat,
          },
        };
      });
      track(AnalyticsEvents.recipe_saved, { recipeId });

      // Nudge: when user saves their 3rd recipe and has no plan yet, prompt plan generation
      const newCount = savedRecipeIds.length + 1; // optimistic count after this save
      const activePlan = mealPlanSlotsRef.current.find((s) => s.id === activeMealPlanSlotIdRef.current)?.plan;
      if (newCount === 3 && (!activePlan || activePlan.length === 0)) {
        setTimeout(() => {
          toast.success("You have 3 recipes — ready to generate a meal plan!", {
            action: { label: "Open Planner", onClick: () => { window.location.href = "/home?view=planner"; } },
            duration: 8000,
          });
        }, 1500);
      }

      if (authedUserId && dbSavesEnabled) {
        supabase
          .from("saves")
          .insert({ user_id: authedUserId, recipe_id: recipeId })
          .then(({ error }) => {
            if (error) {
              const msg = error.message ?? "";
              if (looksLikeMissingTableError(msg)) {
                setDbSavesEnabled(false);
                if (!dbSavesWarned) {
                  setDbSavesWarned(true);
                  toast.warning(syncDisabledBecauseSchemaMessage("Saved recipes"));
                }
                return;
              }
              // Server-side Free-tier cap (RLS policy `saves_insert_own`,
              // see `supabase/migrations/20260426100000_saves_free_tier_cap.sql`).
              // Roll back the optimistic in-memory save and show the same
              // paywall toast the client guard shows, so the UI stays honest
              // even when the client and server disagree on the count (e.g.
              // a second device just saved the 10th recipe).
              const code = (error as { code?: string }).code;
              const lowered = msg.toLowerCase();
              if (code === "42501" || lowered.includes("row-level security") || lowered.includes("row level security")) {
                setSavedRecipeIds((prev) => prev.filter((id) => id !== recipeId));
                setSavedAtById((prev) => {
                  const { [recipeId]: _drop, ...rest } = prev;
                  return rest;
                });
                setLibraryEntryKindByRecipeId((prev) => {
                  const { [recipeId]: _drop, ...rest } = prev;
                  return rest;
                });
                toast.error(`Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes.`, {
                  action: { label: "See plans", onClick: () => { window.location.href = "/pricing"; } },
                });
                return;
              }
              toast.error(syncFailedRetryMessage("saved recipe", error.message ?? ""));
            } else {
              toast.success("Saved to library");
            }
          });
      } else {
        toast.success("Saved to library");
      }
      return true;
    },
    [savedRecipeIds, authedUserId, dbSavesEnabled, dbSavesWarned, uploadedRecipes, myLibraryRecipes],
  );

  const ensureRecipeInLibraryWithKind = useCallback(
    (recipeId: string, kind: LibraryEntryKind) => {
      const iso = new Date().toISOString();
      setSavedRecipeIds((prev) => (prev.includes(recipeId) ? prev : [recipeId, ...prev]));
      setSavedAtById((prev) => ({ ...prev, [recipeId]: prev[recipeId] ?? iso }));
      setLibraryEntryKindByRecipeId((prev) => ({ ...prev, [recipeId]: kind }));
      setSavedRecipeMetaById((prev) => {
        const r =
          myLibraryRecipes.find((x) => x.id === recipeId) ??
          uploadedRecipes.find((x) => x.id === recipeId) ??
          null;
        if (!r) return prev;
        return {
          ...prev,
          [recipeId]: {
            title: r.title,
            image: r.image,
            creatorName: r.creatorName,
            creatorImage: r.creatorImage,
            calories: r.calories,
            protein: r.protein,
            carbs: r.carbs,
            fat: r.fat,
          },
        };
      });
      void refreshMyLibraryRecipes();
      if (authedUserId && dbSavesEnabled) {
        supabase
          .from("saves")
          .insert({ user_id: authedUserId, recipe_id: recipeId })
          .then(({ error }) => {
            if (error) {
              const msg = error.message ?? "";
              if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
                return;
              }
              if (looksLikeMissingTableError(msg)) {
                setDbSavesEnabled(false);
                if (!dbSavesWarned) {
                  setDbSavesWarned(true);
                  toast.warning(syncDisabledBecauseSchemaMessage("Saved recipes"));
                }
                return;
              }
              toast.error(syncFailedRetryMessage("saved recipe", error.message ?? ""));
            }
          });
      }
    },
    [authedUserId, dbSavesEnabled, dbSavesWarned, refreshMyLibraryRecipes, myLibraryRecipes, uploadedRecipes],
  );

  const discoverRecipes = useMemo((): RecipeCard[] => {
    const uploaded = uploadedRecipes.map((r) => ({
      ...r,
      isSaved: savedRecipeIds.includes(r.id),
      feedSource: "community" as const,
    }));
    // Audit gap #3 (Wave 4, 2026-05-02) — prepend the curated static
    // seed (`seedRecipesV2`) so Discover never feels empty at the
    // solo-tester stage. Seeds are content-curated, not algorithmic;
    // they take stable precedence ahead of any DB-sourced rows.
    // Mirrors `apps/mobile/lib/recipes.ts#useDiscoverRecipes`.
    // Each seed carries `feedSource: "catalog"` so downstream UI can
    // distinguish them from community uploads when needed.
    const seeds = seedsToRecipeCards(SEED_RECIPES_V2) as unknown as RecipeCard[];
    return [...seeds, ...uploaded];
  }, [savedRecipeIds, uploadedRecipes]);

  const communityFeedCount = uploadedRecipes.length;

  const savedRecipesForLibrary = useMemo((): Array<RecipeCard & { savedAt: Date }> => {
    // F-7 (TestFlight `AO2jdncS2GxyJaeXPPFR30M`, 2026-04-18):
    // imports / created drafts are "mine by nature" — they stay in
    // Library even when the user has unsaved them. The composer
    // (src/lib/recipes/composeLibraryEntries.ts) owns the union
    // rules and is shared with mobile's matching hook.
    //
    // F-8: the old `savedRecipeMetaById` "Unavailable" fallback is
    // gone — orphan saves are filtered at load time (see saves
    // effect) and the composer drops anything whose recipe can't be
    // found instead of synthesising a placeholder card.
    return composeLibraryEntries({
      userId: authedUserId,
      saves: savedRecipeIds.map((id) => ({
        recipeId: id,
        createdAt: savedAtById[id] ?? null,
      })),
      authoredRecipes: myLibraryRecipes,
      communityRecipes: uploadedRecipes,
    });
  }, [savedRecipeIds, savedAtById, uploadedRecipes, myLibraryRecipes, authedUserId]);

  const value = useMemo(
    (): AppDataContextValue => ({
      userId: authedUserId,
      authEmail,
      profileDisplayName,
      profileTier,
      profileTimeZone,
      refreshProfileBasics,
      profileMeasurementSystem,
      setProfileMeasurementSystem,
      profileWeightSurfaceMode,
      setProfileWeightSurfaceMode,
      redeemPromoCode,
      signOut,
      generateMealPlan,
      generateShoppingListFromPlan,
      shoppingListOutOfSync,
      shoppingListPlanStartDate,
      pantryStaples,
      savePantryStaples,
      discoverRecipes,
      communityFeedCount,
      refreshDiscoverRecipes,
      toggleSaveRecipe,
      ensureRecipeInLibraryWithKind,
      libraryEntryKindByRecipeId,
      savedRecipeMetaById,
      refreshMyLibraryRecipes,
      duplicateRecipeToCreatedDraft,
      isRecipeSaved,
      savedRecipesForLibrary,
      shoppingItems,
      setShoppingItems,
      toggleShoppingChecked,
      removeShoppingItem,
      addShoppingItem,
      activeHouseholdId,
      nutritionTargets,
      setNutritionTargets,
      preferActivityAdjustedCalories,
      setPreferActivityAdjustedCalories,
      netCarbsLensEnabled,
      setNetCarbsLensEnabled,
      activityBurnKcal,
      setActivityBurnKcal,
      activityBurnForSelectedDay,
      activityBurnByDay,
      setActivityBurnForSelectedDay,
      addWaterMlForSelectedDay,
      extraWaterMlForSelectedDay,
      addCaffeineMgForSelectedDay,
      extraCaffeineMgForSelectedDay,
      extraCaffeineByDay,
      addAlcoholGForSelectedDay,
      extraAlcoholGForSelectedDay,
      extraAlcoholGByDay,
      resetHydrationStimulantsForDay,
      targetCaffeineMg,
      setTargetCaffeineMg,
      targetAlcoholGWeekly,
      setTargetAlcoholGWeekly,
      workoutsByDay,
      basalBurnByDay,
      extraWaterByDay,
      selectedDateKey,
      setSelectedDateKey,
      mealsForSelectedDate,
      addLoggedMeal,
      addLoggedMealForDate,
      removeLoggedMeal,
      updateLoggedMeal,
      copyMealToDate,
      copyMealToDateRange,
      duplicateDay,
      duplicateDayToDateRange,
      mealPlan,
      setMealPlan,
      mealPlanSlots,
      activeMealPlanSlotId,
      switchMealPlanSlot,
      createMealPlanSlot,
      renameMealPlanSlot,
      deleteMealPlanSlot,
      nutritionJournalHydrated,
      nutritionByDay,
      notificationsInbox,
      notificationsUnreadCount,
      notificationPrefs,
      setNotificationPrefs,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      addNotification: pushNotification,
    }),
    [
      authedUserId,
      authEmail,
      profileDisplayName,
      profileTier,
      profileTimeZone,
      refreshProfileBasics,
      profileMeasurementSystem,
      setProfileMeasurementSystem,
      profileWeightSurfaceMode,
      setProfileWeightSurfaceMode,
      redeemPromoCode,
      signOut,
      generateMealPlan,
      generateShoppingListFromPlan,
      shoppingListOutOfSync,
      shoppingListPlanStartDate,
      pantryStaples,
      savePantryStaples,
      discoverRecipes,
      communityFeedCount,
      refreshDiscoverRecipes,
      toggleSaveRecipe,
      ensureRecipeInLibraryWithKind,
      libraryEntryKindByRecipeId,
      savedRecipeMetaById,
      refreshMyLibraryRecipes,
      duplicateRecipeToCreatedDraft,
      isRecipeSaved,
      savedRecipesForLibrary,
      shoppingItems,
      setShoppingItems,
      toggleShoppingChecked,
      removeShoppingItem,
      addShoppingItem,
      activeHouseholdId,
      nutritionTargets,
      setNutritionTargets,
      preferActivityAdjustedCalories,
      setPreferActivityAdjustedCalories,
      netCarbsLensEnabled,
      setNetCarbsLensEnabled,
      activityBurnKcal,
      setActivityBurnKcal,
      activityBurnForSelectedDay,
      activityBurnByDay,
      setActivityBurnForSelectedDay,
      addWaterMlForSelectedDay,
      extraWaterMlForSelectedDay,
      addCaffeineMgForSelectedDay,
      extraCaffeineMgForSelectedDay,
      extraCaffeineByDay,
      addAlcoholGForSelectedDay,
      extraAlcoholGForSelectedDay,
      extraAlcoholGByDay,
      resetHydrationStimulantsForDay,
      targetCaffeineMg,
      setTargetCaffeineMg,
      targetAlcoholGWeekly,
      setTargetAlcoholGWeekly,
      workoutsByDay,
      basalBurnByDay,
      extraWaterByDay,
      selectedDateKey,
      setSelectedDateKey,
      mealsForSelectedDate,
      addLoggedMeal,
      addLoggedMealForDate,
      removeLoggedMeal,
      updateLoggedMeal,
      copyMealToDate,
      copyMealToDateRange,
      duplicateDay,
      duplicateDayToDateRange,
      mealPlan,
      setMealPlan,
      mealPlanSlots,
      activeMealPlanSlotId,
      switchMealPlanSlot,
      createMealPlanSlot,
      renameMealPlanSlot,
      deleteMealPlanSlot,
      nutritionJournalHydrated,
      nutritionByDay,
      notificationsInbox,
      notificationsUnreadCount,
      notificationPrefs,
      setNotificationPrefs,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      pushNotification,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}
