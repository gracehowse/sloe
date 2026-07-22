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
import { pickHeroImageUrl } from "../lib/recipes/heroImageFallback.ts";
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
import { tierRank } from "../lib/tier/tierRank.ts";
import {
  parseDayTargetSchedule,
  type DayTargetSchedule,
} from "../lib/nutrition/dayTargetSchedule.ts";
import { type AppNotification, type NotificationPrefs } from "../types/notifications.ts";
import { useNotifications } from "./NotificationContext.tsx";
import { useHousehold } from "./HouseholdContext.tsx";
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
import { track, isFeatureEnabled } from "../lib/analytics/track.ts";
import {
  runPlanShoppingSync,
  planShoppingSyncedPayload,
  type PlanShoppingEditRef,
} from "../lib/planning/planShoppingSyncHost.ts";
import { useAuthSession } from "./AuthSessionContext.tsx";
import {
  DEFAULT_MEAL_PLAN_SLOT_ID,
  loadSnapshot,
  newId,
  type MealPlanNamedSlot,
} from "./appData/persistence.ts";
// ENG-1540: seed "today" from the LOCAL calendar day, not UTC. The
// persistence `dateKey` helper is `toISOString().slice(0,10)` (UTC) and
// shifted the selected day for users behind UTC in the evening — meals
// are keyed by the local day (`dateKeyFromDate`), so the two must match.
import { dateKeyFromDate } from "@/lib/datetime/dateKey";
import { FREE_SAVE_LIMIT } from "./appData/constants.ts";
import { fetchAllUserSaves } from "@/lib/recipes/fetchAllUserSaves";
import { NEUTRAL_AVATAR_DATA_URI } from "@/lib/ui/neutralAvatar";
import { isFreeTierPlanCapError } from "@/lib/mealPlan/planPersistError";
import { fetchPublicRecipeSaveCounts } from "../lib/recipes/fetchPublicRecipeSaveCounts.ts";
import { normalizeRecipeTitle } from "../lib/recipes/normalizeRecipeTitle.ts";
import {
  SEED_RECIPES_V2,
  isRetiredDiscoverSeedCard,
} from "../lib/recipes/seedRecipesV2.ts";
import { seedsToRecipeCards } from "../lib/recipes/seedRecipesToCard.ts";
import { isDiscoverReadyRecipeCard } from "../lib/recipes/discoverRecipeReadiness.ts";
import {
  fetchMaterialisedSeedMap,
  isUuid,
  materialiseSeedRecipeById,
} from "../lib/recipes/materialiseSeedRecipe.ts";
import {
  looksLikeMissingTableError,
  syncDisabledBecauseSchemaMessage,
  syncFailedRetryMessage,
} from "./appData/supabaseErrors.ts";
import { useNutritionJournalState } from "./appData/useNutritionJournalState.ts";
import { usePersistLocalAppSnapshot } from "./appData/usePersistLocalAppSnapshot.ts";
import { useRetryEnableDbTable } from "./appData/useRetryEnableDbTable.ts";
import { useShoppingListState } from "./appData/useShoppingListState.ts";
import type { RecipeCollection } from "../lib/recipes/recipeCollections.ts";
import { useRecipeCollections } from "./RecipeCollectionsContext.tsx";
import { fingerprintMealPlanForShopping } from "../lib/planning/mealPlanFingerprint.ts";
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
import {
  regenerateShoppingListFromPlan,
  type RegenShoppingClient,
  type RegenerateShoppingListResult,
} from "../lib/planning/regenerateShoppingListFromPlan.ts";
import { startDateForOffset } from "../lib/mealPlan/planCalendarAnchor.ts";
import {
  cloudSlotIdFromLocal,
  fetchMealPlanForLocalSlot,
  mergeCloudMetadataIntoSlots,
  metadataFromSlots,
  parseMealPlanSlotsMetadata,
  type MealPlanSlotSyncLedger,
} from "../lib/mealPlan/slotCloudSync.ts";
import { shoppingListShouldClear } from "../lib/planning/shoppingListLifecycle.ts";

// Monotonic counter so the profile-sync realtime subscription below gets
// a UNIQUE channel topic per mount — same class of bug as ENG-794 /
// ENG-1473 (mobile notif-count channel). A provider remount (Strict-Mode
// double-invoke, HMR) whose cleanup calls the async, un-awaited
// `supabase.removeChannel` can leave a same-topic channel still
// subscribed; the remount's `supabase.channel(<same topic>)` then
// returns that already-subscribed channel and the following `.on()`
// throws. Appending a monotonic id makes every subscription's topic
// unique so a lingering channel can never collide.
let profileRealtimeSeq = 0;

/**
 * ENG-1493 — the EXACT `save_meal_plan` RPC payload for a plan + slot +
 * anchor. One builder feeds (a) the debounced persist effect's RPC call,
 * (b) the fingerprint it gates on, and (c) the hydration-time fingerprint
 * seed — so the "already persisted, skip" comparison can never drift from
 * what would actually be written.
 */
function buildSaveMealPlanArgs(
  plan: DayPlan[],
  localSlotId: string,
  persistedStartDate: string,
) {
  return {
    p_slot_id: cloudSlotIdFromLocal(localSlotId),
    p_start_date: persistedStartDate,
    p_plan: plan.map((dp) => ({
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
    })),
  };
}

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
    source?: PlanSourceMode;
    keepLocked?: boolean;
    allowLeftovers?: boolean;
    calorieFloorMin?: number;
    /** ENG-1491 — chip offset (0 | 1 | 7); full generation re-anchors to `today + startOffset`. */
    startOffset?: number;
  }) => Promise<void>;
  generateShoppingListFromPlan: () => Promise<void>;
  /**
   * ENG-957 — edit-driven re-sync of the shopping list when a single meal is
   * added / removed / swapped in the plan (flag `plan_shopping_sync_v1`). Unlike
   * `generateShoppingListFromPlan` (full delete-and-replace), this appends/merges
   * (add) or decrements only the outgoing recipe's contribution (remove/swap),
   * preserving checked rows + household-mate additions. No-op when the flag is
   * off or the user is signed out. Fire-and-forget from the host.
   */
  syncShoppingListForPlanEdit: (edit: PlanShoppingEditRef) => Promise<void>;
  /**
   * ENG-1527 — "Update from plan" re-sync. Regenerates the list from the
   * current plan NON-destructively (checked rows + manual/household additions
   * preserved) and clears the out-of-sync flag. Returns counts / error so the
   * caller can toast the outcome.
   */
  resyncShoppingListFromPlan: () => Promise<RegenerateShoppingListResult>;
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
  /**
   * ENG-1313 — true once the data that DECIDES what the Library shows
   * has settled: auth session resolved, and (when signed in) both the
   * cloud saves fetch and the authored-recipes fetch have completed at
   * least once. Until then `savedRecipesForLibrary` may be a transient
   * empty array — route guards (Library → Discover, ENG-100) must not
   * redirect on it, and the Library renders its loading skeleton.
   */
  libraryDataReady: boolean;
  /** ENG-1126 — user-created recipe collections (Paprika parity). */
  recipeCollections: RecipeCollection[];
  /** Per-recipe collection membership; keys are recipe ids, values are collection ids. */
  collectionMembershipByRecipeId: Readonly<Record<string, string[]>>;
  createCollection: (name: string) => Promise<boolean>;
  renameCollection: (collectionId: string, name: string) => Promise<boolean>;
  deleteCollection: (collectionId: string) => Promise<boolean>;
  addRecipeToCollection: (collectionId: string, recipeId: string) => Promise<boolean>;
  removeRecipeFromCollection: (collectionId: string, recipeId: string) => Promise<boolean>;
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
  /** ENG-849 — member count for household-aware decorative copy on Today. */
  householdMemberCount: number;
  nutritionTargets: MacroTargets;
  setNutritionTargets: Dispatch<SetStateAction<MacroTargets>>;
  /** ENG-960 — opt-in day-target schedule (null = flat week). The Today ring
   *  applies it to `nutritionTargets` for the displayed weekday. */
  dayTargetSchedule: DayTargetSchedule | null;
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
  addLoggedMeal: (
    meal: Omit<LoggedMeal, "id">,
    analyticsSource?: FoodLoggedSource,
    // ENG-751 — fired once the parent nutrition_entries insert resolves so the
    // AI-commit caller can chain a per-item snapshot write off a confirmed FK.
    onPersisted?: (persisted: boolean, entryId: string) => void,
  ) => string;
  addLoggedMealForDate: (
    dayKey: string,
    meal: Omit<LoggedMeal, "id">,
    analyticsSource?: FoodLoggedSource,
  ) => string;
  removeLoggedMeal: (mealId: string) => void;
  /** ENG-1122 — optimistic update + Supabase persist for edited journal rows. */
  updateLoggedMeal: (dayKey: string, updated: LoggedMeal) => Promise<boolean>;
  /** Copy one logged meal to another day (batch 1.4 — copy meal / duplicate day).
   *  Optional `targetSlot` renames the clone's slot when it differs from the source. */
  copyMealToDate: (sourceDayKey: string, mealId: string, targetDayKey: string, targetSlot?: string) => Promise<void>;
  /** Copy one logged meal to every day in the deduped, source-excluded target list. */
  copyMealToDateRange: (sourceDayKey: string, mealId: string, targetDayKeys: string[], targetSlot?: string) => Promise<void>;
  /** ENG-786 rebuild — "Copy to another day": copy every entry in `sourceSlot`
   *  on `sourceDayKey` to `targetSlot` on each of `targetDayKeys`. */
  copySlotToDateRange: (
    sourceDayKey: string,
    sourceSlot: string,
    targetSlot: string,
    targetDayKeys: string[],
  ) => Promise<{ itemCount: number; createdIdsByDay: Record<string, string[]> }>;
  /** Undo for `copySlotToDateRange` — removes exactly the rows it created. */
  undoCopyToSlot: (createdIdsByDay: Record<string, string[]>) => void;
  /** Duplicate every meal from the source day into a single target day. */
  duplicateDay: (sourceDayKey: string, targetDayKey: string) => Promise<void>;
  /** Duplicate every meal from the source day into every day in the deduped target list. */
  duplicateDayToDateRange: (sourceDayKey: string, targetDayKeys: string[]) => Promise<void>;
  mealPlan: DayPlan[] | null;
  setMealPlan: Dispatch<SetStateAction<DayPlan[] | null>>;
  /** ENG-1491 — persisted T7 anchor (`meal_plan_days.start_date`) of the
   *  active slot; null until hydrated / for legacy pre-anchor rows. */
  mealPlanStartDate: string | null;
  /** ENG-1492 twin — re-anchor before a full-replacement `setMealPlan`. */
  reanchorMealPlan: (offset?: number) => void;
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
  /**
   * ENG-1324 — widen the journal to a history window (inclusive `date_key`
   * lower bound). Progress/Profile mount this via `useNutritionHistoryWindow`
   * so their >35-day stats see real history (mobile-Progress parity).
   */
  ensureNutritionHistory: (startKey: string) => void;
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
  const { authedUserId, authEmail, authResolved } = useAuthSession();
  const initial = useMemo(() => loadSnapshot(), []);

  // Notifications are now managed by NotificationContext (wrapped above in providers.tsx).
  const notifications = useNotifications();

  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>(initial.savedRecipeIds);
  // ENG-1467 — copy-on-save: Discover seed recipes have slug ids
  // (`seed-v2-...`), not UUIDs, so they can never appear directly in
  // `savedRecipeIds` (which mirrors the `saves` table's real `recipe_id`
  // uuid column). This map remembers, per session, which seed id
  // resolves to which materialised `recipes` row, so `isRecipeSaved` /
  // `toggleSaveRecipe` both read/write through the real id transparently.
  // Rebuilt from the DB in the saves-sync effect below via
  // `fetchMaterialisedSeedMap` so it survives reloads. Mirrors the
  // mobile `useSavedRecipes` fix in `apps/mobile/lib/recipes.ts`.
  const seedSaveMapRef = useRef<Record<string, string>>({});
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
  /**
   * ENG-1194: per-slot sync ledger (updatedAt + tombstones). Kept in a ref, not
   * React state — it never drives render, only the cloud metadata write-back +
   * merge. Stamped on every create/rename/delete; reconciled by the cloud merge.
   */
  const mealPlanSlotLedgerRef = useRef<MealPlanSlotSyncLedger>({});
  const stampMealPlanSlot = useCallback((slotId: string, deleted: boolean) => {
    const nowIso = new Date().toISOString();
    const prev = mealPlanSlotLedgerRef.current;
    mealPlanSlotLedgerRef.current = {
      ...prev,
      [slotId]: { updatedAt: nowIso, deletedAt: deleted ? nowIso : null },
    };
  }, []);

  const mealPlan = useMemo(() => {
    return mealPlanSlots.find((s) => s.id === activeMealPlanSlotId)?.plan ?? null;
  }, [mealPlanSlots, activeMealPlanSlotId]);

  /**
   * ENG-1491 — persisted T7 anchor (`meal_plan_days.start_date`) for the
   * ACTIVE slot. Hydrated from the cloud row, replaced only at full
   * generation, and passed through by the persist effect — so an edit or
   * hydration re-save can never re-anchor a saved plan to wall-clock
   * today (the pre-fix behaviour, which shifted every log-as-planned
   * calendar date and mislabeled the Plan header week on both platforms).
   */
  const [mealPlanStartDate, setMealPlanStartDate] = useState<string | null>(null);
  const mealPlanStartDateRef = useRef(mealPlanStartDate);
  mealPlanStartDateRef.current = mealPlanStartDate;
  /**
   * ENG-1491 — persist is blocked until the active slot's cloud anchor has
   * hydrated (or a fresh generation defines one). Without this, the mount /
   * slot-switch frame with a locally-cached plan would persist before the
   * anchor fetch lands and re-anchor the plan to the today-fallback.
   */
  const mealPlanAnchorLoadedRef = useRef(false);
  /**
   * ENG-1493 — fingerprint (`JSON.stringify` of the exact RPC payload,
   * see `buildSaveMealPlanArgs`) of the last state known to be persisted.
   * Seeded on hydration with what a re-save WOULD write and updated after
   * each successful save, so the debounced persist effect skips
   * identity-only `mealPlan` changes (hydration writes the same plan back
   * through `setMealPlanSlots`) instead of re-saving the identical plan on
   * every /plan load — which also re-fired the Free-tier cap-rejection
   * toast on load for accounts holding a multi-day plan. Real edits, slot
   * switches, and `reanchorMealPlan` all change the payload (meals, slot
   * id, or `p_start_date`), so they still persist.
   */
  const lastPersistedPlanFingerprintRef = useRef<string | null>(null);
  /** ENG-1492 twin — full-replacement flows (plan-import activate, template
   *  apply) re-anchor to today+offset before their `setMealPlan`; EDITS keep
   *  preserving the anchor. Marks the anchor loaded (this replacement
   *  supersedes whatever hydration would have fetched) and writes the ref
   *  synchronously so the debounced persist reads it even pre-rerender. */
  const reanchorMealPlan = useCallback((offset: number = 0) => {
    const next = startDateForOffset(new Date(), offset);
    mealPlanStartDateRef.current = next;
    setMealPlanStartDate(next);
    mealPlanAnchorLoadedRef.current = true;
  }, []);

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
    stampMealPlanSlot(id, false); // ENG-1194: timestamp the create.
    setMealPlanSlots((prev) => [...prev, { id, name: label, plan: null }]);
    setActiveMealPlanSlotId(id);
    return id;
  }, [stampMealPlanSlot]);

  const renameMealPlanSlot = useCallback((slotId: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    stampMealPlanSlot(slotId, false); // ENG-1194: timestamp the rename.
    setMealPlanSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, name: n } : s)));
  }, [stampMealPlanSlot]);

  const deleteMealPlanSlot = useCallback((slotId: string) => {
    setMealPlanSlots((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((s) => s.id !== slotId);
      if (filtered.length === prev.length) return prev; // unknown id — no-op.
      stampMealPlanSlot(slotId, true); // ENG-1194: tombstone the delete.
      if (activeMealPlanSlotIdRef.current === slotId) {
        setActiveMealPlanSlotId(filtered[0]!.id);
      }
      return filtered;
    });
  }, [stampMealPlanSlot]);
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
  // ENG-960 — opt-in day-target schedule (null = flat week). Read from the
  // profile below; the Today ring applies it for the displayed weekday.
  const [dayTargetSchedule, setDayTargetSchedule] = useState<DayTargetSchedule | null>(null);
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

  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => dateKeyFromDate(new Date()));

  // ENG-1364 (phase 2) — household is now owned by `HouseholdContext`
  // (mounted above `AppDataProvider` in `app/providers.tsx`, same pattern as
  // `NotificationContext`). `AppDataContext` reads it through the hook below
  // and re-exposes the two fields on its own value for the raw consumers
  // that haven't migrated to `useHouseholdData()` yet (see the phase-1
  // selector in `context/appData/selectors.ts`) — a deliberate, temporary
  // passthrough, not a new permanent pattern.
  const { activeHouseholdId, householdMemberCount } = useHousehold();

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

  // ENG-1364 (phase 2) — recipe collections now owned by
  // `RecipeCollectionsContext` (mounted above `AppDataProvider` in
  // `app/providers.tsx`). Re-exposed on `AppDataContextValue` below as a
  // backward-compat passthrough for the raw `useAppData()` consumers that
  // mix collections fields with other domains (e.g. `Library.tsx` reading
  // `collectionMembershipByRecipeId` alongside `nutritionTargets`) — a
  // deliberate, temporary passthrough, not a new permanent pattern.
  const {
    recipeCollections,
    collectionMembershipByRecipeId,
    createCollection,
    renameCollection,
    deleteCollection,
    addRecipeToCollection,
    removeRecipeFromCollection,
  } = useRecipeCollections();

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
    ensureJournalHistory,
    addLoggedMealForDate,
    addLoggedMeal,
    removeLoggedMeal,
    updateLoggedMeal,
    mealsForSelectedDate,
    copyMealToDate,
    copyMealToDateRange,
    copySlotToDateRange,
    undoCopyToSlot,
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
    // ENG (Pro-lockout / Free-flash): hydrate the tier from the local cache the
    // moment auth resolves — BEFORE the async profiles round-trip — so a returning
    // Pro isn't shown paid surfaces flashed locked for the fetch duration. Upgrade-
    // only: never downgrades a tier we already hold; the DB fetch below confirms.
    const cachedTier = loadLocalProfile(authedUserId)?.userTier;
    if (cachedTier) {
      setProfileTier((prev) => (tierRank(cachedTier) >= tierRank(prev) ? cachedTier : prev));
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "display_name, user_tier, measurement_system, sex, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, prefer_activity_adjusted_calories, weight_surface_mode, net_carbs_lens_enabled, pantry_staples, meal_plan_slots, tz_iana, calorie_schedule, high_days",
        )
        .eq("id", authedUserId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        const local = loadLocalProfile(authedUserId);
        // ENG (Pro-lockout): a transient profiles fetch error must NOT clobber a
        // known-higher tier to Free — that locks a real Pro out of paid surfaces
        // until a later refetch. Only adopt the cached tier when it's at least as
        // high as what we already hold; never downgrade on a network blip.
        if (local?.userTier) {
          setProfileTier((prev) =>
            tierRank(local.userTier) >= tierRank(prev) ? local.userTier : prev,
          );
        }
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
      // ENG-960 — opt-in day-target schedule (null for everyone not opted in).
      setDayTargetSchedule(
        parseDayTargetSchedule(
          (data as { calorie_schedule?: unknown } | null)?.calorie_schedule,
          (data as { high_days?: unknown } | null)?.high_days,
        ),
      );
      const cloudSlotMeta = parseMealPlanSlotsMetadata(
        (data as { meal_plan_slots?: unknown } | null)?.meal_plan_slots,
      );
      if (cloudSlotMeta) {
        // ENG-1194: merge once (last-writer-wins per slot), then apply slots +
        // active + reconciled ledger so tombstones survive into the next write.
        const merged = mergeCloudMetadataIntoSlots(
          mealPlanSlotsRef.current,
          cloudSlotMeta,
          mealPlanSlotLedgerRef.current,
        );
        mealPlanSlotLedgerRef.current = merged.ledger;
        setMealPlanSlots(merged.slots);
        if (merged.activeSlotId) setActiveMealPlanSlotId(merged.activeSlotId);
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
        "display_name, user_tier, measurement_system, sex, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, prefer_activity_adjusted_calories, weight_surface_mode, net_carbs_lens_enabled, tz_iana, calorie_schedule, high_days",
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
    // ENG-960 — keep the schedule fresh on a post-checkout / manual refresh too.
    setDayTargetSchedule(
      parseDayTargetSchedule(
        (data as { calorie_schedule?: unknown } | null)?.calorie_schedule,
        (data as { high_days?: unknown } | null)?.high_days,
      ),
    );
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
      .channel(`profiles:${authedUserId}:${(profileRealtimeSeq += 1)}`)
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
    // ENG-1491 — re-arm the persist gate: the previous slot's anchor must
    // not label (or persist under) the newly active slot while its own
    // anchor is in flight.
    mealPlanAnchorLoadedRef.current = false;
    // ENG-1493 — drop the previous fingerprint while this slot hydrates;
    // it re-seeds below once the cloud plan lands.
    lastPersistedPlanFingerprintRef.current = null;
    (async () => {
      if (!dbMealPlanEnabled) return;
      const slotId = activeMealPlanSlotIdRef.current;
      const loaded = await fetchMealPlanForLocalSlot(supabase, authedUserId, slotId);
      if (cancelled) return;
      // ENG-1491 — anchor updates even when the slot is empty, so a slot
      // switch can't carry the previous slot's anchor.
      setMealPlanStartDate(loaded?.startDate ?? null);
      mealPlanAnchorLoadedRef.current = true;
      if (!loaded?.plans.length) return;
      // ENG-1493 — seed the persist gate with what the debounced effect
      // WOULD write for the hydrated plan (same today-fallback anchor
      // logic), so the `setMealPlanSlots` below — a pure identity change —
      // doesn't re-save the identical plan on every load.
      lastPersistedPlanFingerprintRef.current = JSON.stringify(
        buildSaveMealPlanArgs(
          loaded.plans,
          slotId,
          loaded.startDate ?? startDateForOffset(new Date(), 0),
        ),
      );
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
    // Keep unauthored rows in the query because creator/community content can
    // legitimately be unauthored. After mapping,
    // `isRetiredDiscoverSeedCard` removes only superseded platform-catalogue
    // rows; the current approved catalogue is always prepended from the shared
    // static Sloe Kitchen source of truth. Mobile mirrors this in recipes.ts.
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, title, image_url, image_source, source_url, source_name, content_origin, servings, is_verified, creator_calories, calories, protein, carbs, fat, fiber_g, created_at, author_id, creator_id, meal_type, prep_time_min, cook_time_min, allergens, dietary_flags, author:profiles!recipes_author_id_fkey(display_name, avatar_url)",
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
        creatorName:
          (row?.author?.display_name as string | null) ??
          (row.source_name as string | null) ??
          "Community",
        creatorImage:
          (row?.author?.avatar_url as string | null) ??
          NEUTRAL_AVATAR_DATA_URI,
        // 2026-04-26 polish: render-time normalisation for legacy
        // ALL-CAPS rows (publisher schema.org name fields). The helper is
        // a no-op for any title that already contains lowercase, so
        // mixed-case authored titles pass through untouched.
        title: normalizeRecipeTitle(row.title as string | null | undefined),
        image: pickHeroImageUrl({
          image_url: row.image_url as string | null,
          image_source: (row as { image_source?: string | null }).image_source ?? null,
          source_url: (row as { source_url?: string | null }).source_url ?? null,
        }) ?? null, // ENG-1287 — no image stays null (RecipeHeroFallback renders)
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
        sourceName: (row.source_name as string | null) ?? null,
        contentOrigin:
          (row.content_origin as
            | "first_party"
            | "imported_stub"
            | "claimed"
            | null) ?? undefined,
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
    }).filter(
      (card: RecipeCard) =>
        !isRetiredDiscoverSeedCard(card) && isDiscoverReadyRecipeCard(card),
    );

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
        "id, title, image_url, image_source, servings, is_verified, creator_calories, calories, protein, carbs, fat, fiber_g, created_at, author_id, creator_id, meal_type, published, source_name, source_url, content_origin, prep_time_min, cook_time_min, allergens, dietary_flags",
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
        image: pickHeroImageUrl({
          image_url: row.image_url as string | null,
          image_source: (row as { image_source?: string | null }).image_source ?? null,
          source_url: (row as { source_url?: string | null }).source_url ?? null,
        }) ?? null, // ENG-1287 — no image stays null (RecipeHeroFallback renders)
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
        contentOrigin: (row as { content_origin?: "first_party" | "imported_stub" | "claimed" | null }).content_origin ?? undefined,
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

  // ENG-1313 — authored-recipes settle signal. Signed out: nothing to
  // fetch, settled immediately. Signed in: unsettled until the first
  // fetch completes (success OR error — the guard's job is to kill the
  // race, not to model fetch failure).
  const [authoredResolved, setAuthoredResolved] = useState(false);
  useEffect(() => {
    if (!authedUserId) {
      setAuthoredResolved(true);
      return;
    }
    setAuthoredResolved(false);
    void refreshMyLibraryRecipes().finally(() => setAuthoredResolved(true));
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
          content_origin: "first_party",
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
      /**
       * ENG-956 — "Refresh the rest". When true AND the active plan has ≥1
       * `isLocked` meal, regenerate keeps the locked meals byte-identical and
       * re-rolls only the unlocked slots (rebalancing the remaining macro
       * budget). When false / no meal locked, the legacy full-plan generate
       * runs. The MealPlanner passes this only under `plan_meal_lock_v1`.
       */
      keepLocked?: boolean;
      /** ENG-1247 / B1 — skip leftover distribution when false (Adjust constraints). */
      allowLeftovers?: boolean;
      /** ENG-1254 — daily calorie floor from Adjust constraints. */
      calorieFloorMin?: number;
      /**
       * ENG-1491 — the Today/Tomorrow/Next-week chip (0 | 1 | 7) at
       * generation time. A FULL generation re-anchors the plan to
       * `today + startOffset`; partial regen (`keepLocked`) and later
       * edits keep the existing anchor. Omitted = today (legacy callers).
       */
      startOffset?: number;
    }) => {
      const { generatePlanFromLibrary, regeneratePlanKeepingLocked } = await import(
        "../lib/planning/generateMealPlan.ts"
      );
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
          calorieFloorMin: o.calorieFloorMin ?? options?.calorieFloorMin,
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
        // ENG-956 — "Refresh the rest". When the caller asked to keep locked
        // meals AND the active plan actually has ≥1 locked meal, re-roll only
        // the unlocked slots against the remaining macro budget, leaving the
        // locked meals byte-identical. Skips the leftover-distribution pass:
        // leftovers depend on a fresh whole-week sample, and re-distributing
        // them would mutate the locked rows we just promised to preserve.
        const activeLockedPlan =
          mealPlanSlotsRef.current.find(
            (s) => s.id === activeMealPlanSlotIdRef.current,
          )?.plan ?? null;
        const lockedCount =
          activeLockedPlan?.reduce(
            (a, dp) => a + dp.meals.filter((m) => m.isLocked).length,
            0,
          ) ?? 0;
        if (options?.keepLocked && activeLockedPlan && lockedCount > 0) {
          const partialStartMs = Date.now();
          const nextPlan = regeneratePlanKeepingLocked({
            existingPlan: activeLockedPlan,
            savedRecipes: pool,
            targets,
            ...(options?.slots && options.slots.length > 0
              ? { slots: options.slots }
              : {}),
          });
          const rerolledCount = nextPlan.reduce(
            (a, dp) => a + dp.meals.filter((m) => !m.isLocked).length,
            0,
          );
          setMealPlan(nextPlan);
          toast.success("Refreshed the unlocked meals");
          track(AnalyticsEvents.plan_regenerated_partial, {
            lockedCount,
            rerolledCount,
            days,
            durationMs: Date.now() - partialStartMs,
            platform: "web",
          });
          return;
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
        const allowLeftovers = options?.allowLeftovers !== false;
        const { plan, leftoverCount } =
          allowLeftovers && Object.keys(recipesByRef).length > 0
            ? distributeLeftovers(rawPlan, recipesByRef)
            : { plan: rawPlan, leftoverCount: 0 };
        const generateDurationMs = Date.now() - generateStartMs;
        // ENG-1491 — a full generation defines the plan's anchor from the
        // chip (batched with setMealPlan, so the ref is fresh before the
        // debounced persist fires). Partial regen above keeps the anchor.
        setMealPlanStartDate(startDateForOffset(new Date(), options?.startOffset ?? 0));
        mealPlanAnchorLoadedRef.current = true;
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

  // ENG-957 — edit-driven plan→shopping-list re-sync. Delegates all merge /
  // decrement + delta-persist logic to the shared `runPlanShoppingSync`; the
  // context just gates on the flag + scope, refreshes local list state, and
  // emits analytics. No-op (silent) when the flag is off or there's nothing to
  // sync — never a full delete-and-replace, so checked rows survive.
  const syncShoppingListForPlanEdit = useCallback(
    async (edit: PlanShoppingEditRef) => {
      if (!isFeatureEnabled("plan_shopping_sync_v1")) return;
      if (!authedUserId || !shoppingScope) return;
      const res = await runPlanShoppingSync({
        client: supabase as unknown as Parameters<typeof runPlanShoppingSync>[0]["client"],
        scope: shoppingScope,
        edit,
      });
      if (!res.ok) {
        toast.error(syncFailedRetryMessage("shopping list", res.error));
        return;
      }
      if ("skipped" in res) return;
      setShoppingItems(filterShoppingItemsByPantry(res.items, pantryStaples));
      track(AnalyticsEvents.plan_shopping_synced, planShoppingSyncedPayload(res, "web"));
    },
    [authedUserId, shoppingScope, pantryStaples, setShoppingItems],
  );

  // ENG-1527 — the "Update from plan" re-sync. Regenerates the list from the
  // current plan NON-destructively via the shared host (checked rows +
  // manual/household additions preserved — never the delete-and-replace that
  // `generateShoppingListFromPlan` runs). On success we refresh the stored
  // fingerprint from the in-memory plan so `shoppingListOutOfSync` clears; the
  // live-sync subscription in `useShoppingListState` repaints the rows.
  const resyncShoppingListFromPlan =
    useCallback(async (): Promise<RegenerateShoppingListResult> => {
      if (!authedUserId || !shoppingScope) {
        return { ok: false, error: "Not signed in" };
      }
      const res = await regenerateShoppingListFromPlan({
        client: supabase as unknown as RegenShoppingClient,
        scope: shoppingScope,
        planSlotId: cloudSlotIdFromLocal(activeMealPlanSlotIdRef.current),
        pantryStaples,
      });
      if (res.ok) {
        setShoppingListSourceFingerprint(fingerprintMealPlanForShopping(mealPlan));
        if (res.planStartDate) setShoppingListPlanStartDate(res.planStartDate);
      }
      return res;
    }, [authedUserId, shoppingScope, pantryStaples, mealPlan]);

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

  // ENG-1313 — cloud-saves settle signal (see `libraryDataReady`).
  const [savesResolved, setSavesResolved] = useState(false);

  // Sync DB-backed saves (Phase 0). Other state remains local for now.
  useEffect(() => {
    if (!authedUserId || !dbSavesEnabled) {
      // Local snapshot IS the deciding data — settled immediately.
      setSavesResolved(true);
      return;
    }
    setSavesResolved(false);
    let cancelled = false;
    (async () => {
      // ENG-1467 — rebuild the seed-id -> materialised-recipe-id map
      // alongside the saves fetch so a previously-saved seed shows as
      // saved via its ORIGINAL slug id (Discover cards only know that
      // id). Errors degrade to an empty map — the seed just renders
      // as not-yet-saved, same as a fresh account.
      const seedMap = await fetchMaterialisedSeedMap(supabase, authedUserId);
      if (cancelled) return;
      seedSaveMapRef.current = seedMap;

      // ENG-1413 — page to exhaustion (fetchAllUserSaves) instead of one
      // unbounded fetch; sort by created_at after all pages land since
      // display order downstream assumes newest-first.
      const { rows: unsorted, error: pageError } = await fetchAllUserSaves(supabase, authedUserId);
      const rows = [...unsorted].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      if (cancelled) {
        return;
      }
      // Any settled outcome (data, error, schema-fallback) unblocks the
      // Library guard — the error branches below still show their toasts.
      setSavesResolved(true);
      if (pageError) {
        // If schema cache doesn't include the table yet, fall back to localStorage so the app stays usable.
        const msg = pageError.message ?? "";
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
      rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      const rawIds = rows.map((r) => r.recipe_id);
      const savedAt: Record<string, string> = {};
      for (const r of rows) {
        savedAt[r.recipe_id] = r.created_at ?? new Date().toISOString();
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

      // ENG-1467 — surface a materialised seed as saved via its
      // ORIGINAL slug id too, mirroring the mobile fix.
      const idSet = new Set(ids);
      for (const [seedId, materialisedId] of Object.entries(seedMap)) {
        if (idSet.has(materialisedId) && !idSet.has(seedId)) {
          idSet.add(seedId);
          savedAt[seedId] = savedAt[materialisedId] ?? new Date().toISOString();
        }
      }

      setSavedRecipeIds(Array.from(idSet));
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
      // ENG-1491 — never persist before the slot's cloud anchor hydrates:
      // the mount / slot-switch frame with a locally-cached plan would
      // otherwise write the today-fallback and re-anchor the plan.
      if (!mealPlanAnchorLoadedRef.current) return;
      // ENG-1491 anchor contract: persist the plan's KNOWN start_date
      // (hydrated, or set at generation from the Today/Tomorrow/Next-week
      // chip) — never re-derive from wall-clock. The previous hard-coded
      // "today" predated the F2-D chip and meant every hydration/edit
      // re-save silently re-anchored the plan, shifting log-as-planned
      // dates on both platforms. Today remains only as the legacy
      // fallback for rows saved before the anchor column existed.
      // T15 (2026-04-24) atomic save: single RPC replaces the previous
      // DELETE + bulk-INSERT pair so a network drop mid-save can no
      // longer leave an orphaned half.
      const persistedStartDate =
        mealPlanStartDateRef.current ?? startDateForOffset(new Date(), 0);
      const rpcArgs = buildSaveMealPlanArgs(
        mealPlan,
        activeMealPlanSlotIdRef.current,
        persistedStartDate,
      );
      // ENG-1493 — skip identity-only re-saves: hydration writes the cloud
      // plan back through `setMealPlanSlots`, which used to re-fire this
      // effect and re-save the identical plan on every /plan load (and
      // re-toast the Free-tier cap rejection). The fingerprint is the exact
      // RPC payload, so any real change — meals, portion, slot, or the
      // `reanchorMealPlan` start-date — still persists.
      const fingerprint = JSON.stringify(rpcArgs);
      if (fingerprint === lastPersistedPlanFingerprintRef.current) return;
      const { error } = await supabase.rpc("save_meal_plan", rpcArgs as never);

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
        // ENG-1387 — the RPC now enforces the Free-tier 1-day cap
        // server-side. Unreachable through the UI (the client clamps
        // generation to 1 day first); fires on a stale-cached-tier
        // desync or a Pro→Free downgrade holding a multi-day plan.
        // The rejection is atomic, so the existing cloud plan is
        // untouched — tell the user their edit didn't sync rather
        // than failing silently.
        if (isFreeTierPlanCapError({ code: (error as { code?: string }).code, message: msg })) {
          toast.error(
            "Free plan is limited to 1-day meal plans, so this plan couldn't sync. Upgrade to plan your full week.",
          );
          return;
        }
        console.error("[mealPlan] save_meal_plan failed:", msg);
        return;
      }
      // ENG-1493 — remember what we just wrote so an identity-only change
      // (or the exact same plan state) doesn't save again.
      lastPersistedPlanFingerprintRef.current = fingerprint;
      // Legacy row saved via the today-fallback: adopt what we wrote so
      // the anchor is stable from here (a next-day edit must not drift it).
      if (!mealPlanStartDateRef.current) setMealPlanStartDate(persistedStartDate);
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, dbMealPlanEnabled, dbMealPlanWarned, mealPlan]);

  // ENG-1130 — sync named slot registry (ids, names, active) to profiles.
  // ENG-1194 — payload now also carries per-slot updatedAt + tombstones so a
  // cross-device delete propagates (last-writer-wins) instead of being re-pushed.
  useEffect(() => {
    if (!authedUserId || !mealPlanSlotsCloudLoadedRef.current) return;
    const t = setTimeout(async () => {
      const payload = metadataFromSlots(
        mealPlanSlotsRef.current,
        activeMealPlanSlotIdRef.current,
        mealPlanSlotLedgerRef.current, // ENG-1194: carry timestamps + tombstones.
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
          // ENG-1467 — a seed recipe's `saves` row (if it was ever
          // successfully saved post-fix) is keyed by the MATERIALISED
          // recipe id, not the slug id the UI/state use. Resolve it
          // before issuing the delete.
          const dbRecipeId = isUuid(recipeId) ? recipeId : seedSaveMapRef.current[recipeId];
          if (!dbRecipeId) {
            // Nothing to unsave server-side (e.g. a seed that was never
            // successfully materialised — pre-fix optimistic state, or
            // the earlier bug's silent failure). Local removal above is
            // enough; no DB round-trip to make.
            toast.success("Removed from library");
          } else {
            supabase
              .from("saves")
              .delete()
              .eq("user_id", authedUserId)
              .eq("recipe_id", dbRecipeId)
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
          }
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

      const rollbackSave = () => {
        setSavedRecipeIds((prev) => prev.filter((id) => id !== recipeId));
        setSavedAtById((prev) => {
          const { [recipeId]: _drop, ...rest } = prev;
          return rest;
        });
        setLibraryEntryKindByRecipeId((prev) => {
          const { [recipeId]: _drop, ...rest } = prev;
          return rest;
        });
      };

      const handleSaveInsertError = (error: { message?: string; code?: string }) => {
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
        const code = error.code ?? "";
        const lowered = msg.toLowerCase();
        if (code === "42501" || lowered.includes("row-level security") || lowered.includes("row level security")) {
          rollbackSave();
          toast.error(`Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes.`, {
            action: { label: "See plans", onClick: () => { window.location.href = "/pricing"; } },
          });
          return;
        }
        // Pre-existing behaviour, unchanged: a generic persistence error
        // still just warns — the optimistic save is left in place (not
        // rolled back) since the row may in fact have landed and this is
        // a response-parsing/network hiccup rather than a confirmed
        // rejection. Reconciles on next full load.
        toast.error(syncFailedRetryMessage("saved recipe", msg));
      };

      if (authedUserId && dbSavesEnabled) {
        if (isUuid(recipeId)) {
          supabase
            .from("saves")
            .insert({ user_id: authedUserId, recipe_id: recipeId })
            .then(({ error }) => {
              if (error) handleSaveInsertError(error);
              else toast.success("Saved to library");
            });
        } else {
          // ENG-1467 — copy-on-save. A non-UUID id means this is a
          // Discover seed (or any future non-DB catalogue entry);
          // materialise its real `recipes` row before touching `saves`,
          // whose `recipe_id` column is a uuid FK. Async, so this runs
          // after the optimistic UI update above (matching the
          // fire-and-forget shape the UUID branch already has).
          (async () => {
            const result = await materialiseSeedRecipeById(supabase, authedUserId, recipeId);
            if (!result.ok) {
              console.error("[toggleSaveRecipe] seed materialise failed:", result.error, "| recipeId:", recipeId);
              rollbackSave();
              toast.error(result.error);
              return;
            }
            seedSaveMapRef.current = { ...seedSaveMapRef.current, [recipeId]: result.recipeId };
            const { error } = await supabase
              .from("saves")
              .insert({ user_id: authedUserId, recipe_id: result.recipeId });
            if (error) {
              handleSaveInsertError(error);
              return;
            }
            toast.success("Saved to library");
            // The Library screen resolves saved-recipe details via
            // `composeLibraryEntries`, which looks the id up in
            // `myLibraryRecipes` (author-owned rows) / `uploadedRecipes`
            // (community) — NOT `savedRecipeMetaById`. The freshly
            // materialised row is author-owned by this user but isn't in
            // `myLibraryRecipes` yet, so without this refresh the Library
            // card would silently drop as an "orphan save" until the next
            // full reload. Same refresh `duplicateRecipeToCreatedDraft`
            // and `ensureRecipeInLibraryWithKind` already do after
            // inserting a new authored row.
            await refreshMyLibraryRecipes();
          })();
        }
      } else {
        toast.success("Saved to library");
      }
      return true;
    },
    [savedRecipeIds, authedUserId, dbSavesEnabled, dbSavesWarned, uploadedRecipes, myLibraryRecipes, refreshMyLibraryRecipes],
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
    const seeds = (
      seedsToRecipeCards(SEED_RECIPES_V2) as unknown as RecipeCard[]
    ).filter(isDiscoverReadyRecipeCard);
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

  // ENG-1313 — see the interface doc. Auth must resolve first: on a cold
  // load `authedUserId` is null for a beat, which would otherwise settle
  // the two per-user signals in their "signed out" branches and let the
  // Library→Discover guard fire before the session (then the saves)
  // arrive.
  const libraryDataReady = authResolved && savesResolved && authoredResolved;

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
      syncShoppingListForPlanEdit,
      resyncShoppingListFromPlan,
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
      libraryDataReady,
      recipeCollections,
      collectionMembershipByRecipeId,
      createCollection,
      renameCollection,
      deleteCollection,
      addRecipeToCollection,
      removeRecipeFromCollection,
      shoppingItems,
      setShoppingItems,
      toggleShoppingChecked,
      removeShoppingItem,
      addShoppingItem,
      activeHouseholdId,
      householdMemberCount,
      nutritionTargets,
      setNutritionTargets,
      dayTargetSchedule,
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
      copySlotToDateRange,
      undoCopyToSlot,
      duplicateDay,
      duplicateDayToDateRange,
      mealPlan,
      setMealPlan,
      mealPlanStartDate,
      reanchorMealPlan,
      mealPlanSlots,
      activeMealPlanSlotId,
      switchMealPlanSlot,
      createMealPlanSlot,
      renameMealPlanSlot,
      deleteMealPlanSlot,
      nutritionJournalHydrated,
      nutritionByDay,
      ensureNutritionHistory: ensureJournalHistory,
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
      syncShoppingListForPlanEdit,
      resyncShoppingListFromPlan,
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
      libraryDataReady,
      recipeCollections,
      collectionMembershipByRecipeId,
      createCollection,
      renameCollection,
      deleteCollection,
      addRecipeToCollection,
      removeRecipeFromCollection,
      shoppingItems,
      setShoppingItems,
      toggleShoppingChecked,
      removeShoppingItem,
      addShoppingItem,
      activeHouseholdId,
      householdMemberCount,
      nutritionTargets,
      setNutritionTargets,
      dayTargetSchedule,
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
      copySlotToDateRange,
      undoCopyToSlot,
      duplicateDay,
      duplicateDayToDateRange,
      mealPlan,
      setMealPlan,
      mealPlanStartDate,
      reanchorMealPlan,
      mealPlanSlots,
      activeMealPlanSlotId,
      switchMealPlanSlot,
      createMealPlanSlot,
      renameMealPlanSlot,
      deleteMealPlanSlot,
      nutritionJournalHydrated,
      nutritionByDay,
      ensureJournalHistory,
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
