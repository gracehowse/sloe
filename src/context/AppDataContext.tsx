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
import { getRecipeById, RECIPE_CATALOG } from "../data/recipeCatalog.ts";
import { effectivePortionMultiplier, normalizeDayPlans } from "../lib/nutrition/portionMultiplier.ts";
import { supabase } from "../lib/supabase/browserClient.ts";
import type { DayPlan, LoggedMeal, RecipeCard, ShoppingItem, UserTier } from "../types/recipe.ts";
import {
  DEFAULT_PLANNER_BANDS,
  type PlannerTargets,
} from "../lib/planning/generateMealPlan.ts";
import { clearLocalProfile, loadLocalProfile } from "../lib/profile/profileStorage.ts";
import { normalizeMacroTargets, type MacroTargets } from "../types/profile.ts";
import { AnalyticsEvents } from "../lib/analytics/events.ts";
import { track } from "../lib/analytics/track.ts";
import { useAuthSession } from "./AuthSessionContext.tsx";
import {
  dateKey,
  DEFAULT_MEAL_PLAN_SLOT_ID,
  defaultSnapshot,
  loadSnapshot,
  newId,
  type MealPlanNamedSlot,
} from "./appData/persistence.ts";
import { DEFAULT_UPLOADED_RECIPE_IMAGE, FREE_SAVE_LIMIT } from "./appData/constants.ts";
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
  authEmail: string | null;
  profileDisplayName: string | null;
  profileTier: UserTier;
  /** Re-fetch tier/display/targets from Supabase (e.g. after Stripe checkout). */
  refreshProfileBasics: () => Promise<void>;
  /** Display preference from profile; internal storage remains metric. */
  profileMeasurementSystem: "metric" | "imperial";
  setProfileMeasurementSystem: Dispatch<SetStateAction<"metric" | "imperial">>;
  redeemPromoCode: (code: string) => Promise<RedeemPromoResult>;
  signOut: () => Promise<void>;
  generateMealPlan: (options?: { targetsOverride?: Partial<PlannerTargets>; days?: number }) => Promise<void>;
  generateShoppingListFromPlan: () => Promise<void>;
  /** True when the list was built from the planner and the meal plan (or portions) has changed since. */
  shoppingListOutOfSync: boolean;
  discoverRecipes: RecipeCard[];
  /** Recipes published by real users (Supabase). Catalog picks are excluded. */
  communityFeedCount: number;
  refreshDiscoverRecipes: () => Promise<void>;
  /** Returns true when a new save was started (not un-save, not blocked by tier limit). */
  toggleSaveRecipe: (recipeId: string, tier: UserTier) => boolean;
  isRecipeSaved: (recipeId: string) => boolean;
  savedRecipesForLibrary: Array<RecipeCard & { savedAt: Date }>;
  shoppingItems: ShoppingItem[];
  setShoppingItems: Dispatch<SetStateAction<ShoppingItem[]>>;
  toggleShoppingChecked: (itemId: string) => void;
  removeShoppingItem: (itemId: string) => void;
  addShoppingItem: (item: Omit<ShoppingItem, "id" | "checked"> & { checked?: boolean }) => void;
  nutritionTargets: MacroTargets;
  setNutritionTargets: Dispatch<SetStateAction<MacroTargets>>;
  preferActivityAdjustedCalories: boolean;
  setPreferActivityAdjustedCalories: Dispatch<SetStateAction<boolean>>;
  /** Default activity burn (kcal) for days without a per-day value in `activityBurnByDay`. */
  activityBurnKcal: number;
  setActivityBurnKcal: Dispatch<SetStateAction<number>>;
  /** Activity burn for the selected tracker day (per-day override or default). */
  activityBurnForSelectedDay: number;
  setActivityBurnForSelectedDay: (kcal: number) => void;
  /** Quick-add water (ml) for the selected day, in addition to per-meal water. */
  addWaterMlForSelectedDay: (ml: number) => void;
  extraWaterMlForSelectedDay: number;
  /** All quick-add water amounts by `YYYY-MM-DD` (for weekly summaries / export). */
  extraWaterByDay: Record<string, number>;
  selectedDateKey: string;
  setSelectedDateKey: Dispatch<SetStateAction<string>>;
  mealsForSelectedDate: LoggedMeal[];
  addLoggedMeal: (meal: Omit<LoggedMeal, "id">) => void;
  addLoggedMealForDate: (dayKey: string, meal: Omit<LoggedMeal, "id">) => void;
  removeLoggedMeal: (mealId: string) => void;
  mealPlan: DayPlan[] | null;
  setMealPlan: Dispatch<SetStateAction<DayPlan[] | null>>;
  mealPlanSlots: MealPlanNamedSlot[];
  activeMealPlanSlotId: string;
  switchMealPlanSlot: (slotId: string) => void;
  createMealPlanSlot: (name: string) => string;
  renameMealPlanSlot: (slotId: string, name: string) => void;
  deleteMealPlanSlot: (slotId: string) => void;
  /** All logged meals by `YYYY-MM-DD` (for streaks / weekly stats in Tracker). */
  nutritionByDay: Record<string, LoggedMeal[]>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { authedUserId, authEmail } = useAuthSession();
  const initial = useMemo(() => loadSnapshot(), []);

  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>(initial.savedRecipeIds);
  const [savedAtById, setSavedAtById] = useState<Record<string, string>>(initial.savedAtById);
  const [uploadedRecipes, setUploadedRecipes] = useState<RecipeCard[]>([]);
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
  const mealPlanSlotsRef = useRef(mealPlanSlots);
  mealPlanSlotsRef.current = mealPlanSlots;

  const mealPlan = useMemo(() => {
    return mealPlanSlots.find((s) => s.id === activeMealPlanSlotId)?.plan ?? null;
  }, [mealPlanSlots, activeMealPlanSlotId]);

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

  const switchMealPlanSlot = useCallback((slotId: string) => {
    if (!mealPlanSlotsRef.current.some((s) => s.id === slotId)) return;
    setActiveMealPlanSlotId(slotId);
  }, []);

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
  const [activityBurnKcal, setActivityBurnKcal] = useState(() => initial.activityBurnKcal ?? 0);
  const [activityBurnByDay, setActivityBurnByDay] = useState<Record<string, number>>(
    () => initial.activityBurnByDay ?? {},
  );
  const [extraWaterByDay, setExtraWaterByDay] = useState<Record<string, number>>(
    () => initial.extraWaterByDay ?? {},
  );
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profileTier, setProfileTier] = useState<UserTier>("free");
  const [profileMeasurementSystem, setProfileMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [dbSavesEnabled, setDbSavesEnabled] = useState(true);
  const [dbSavesWarned, setDbSavesWarned] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [dbMealPlanEnabled, setDbMealPlanEnabled] = useState(true);
  const [dbMealPlanWarned, setDbMealPlanWarned] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => dateKey(new Date()));

  const {
    shoppingItems,
    setShoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
  } = useShoppingListState({ authedUserId, initialItems: initial.shoppingItems });

  const [shoppingListSourceFingerprint, setShoppingListSourceFingerprint] = useState<string | null>(
    initial.shoppingListSourceFingerprint ?? null,
  );

  const {
    nutritionByDay,
    addLoggedMealForDate,
    addLoggedMeal,
    removeLoggedMeal,
    mealsForSelectedDate,
  } = useNutritionJournalState({
    authedUserId,
    initialByDay: initial.nutritionByDay,
    selectedDateKey,
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
    const { error } = await supabase.from("meal_plans").select("user_id").limit(1);
    if (error) {
      return false;
    }
    setDbMealPlanEnabled(true);
    return true;
  }, [authedUserId]);

  useRetryEnableDbTable(authedUserId, dbSavesEnabled, tryEnableDbSaves);
  useRetryEnableDbTable(authedUserId, dbMealPlanEnabled, tryEnableDbMealPlans);

  const shoppingListOutOfSync = useMemo(() => {
    if (shoppingItems.length === 0) return false;
    if (shoppingListSourceFingerprint === null) return false;
    return fingerprintMealPlanForShopping(mealPlan) !== shoppingListSourceFingerprint;
  }, [shoppingItems.length, shoppingListSourceFingerprint, mealPlan]);

  // Load profile basics (tier/display name). Falls back to local profile if needed.
  useEffect(() => {
    if (!authedUserId) {
      const local = loadLocalProfile(null);
      setProfileTier(local?.userTier ?? "free");
      setProfileDisplayName(local?.displayName ?? null);
      setProfileMeasurementSystem(local?.measurementSystem ?? "metric");
      if (local?.targets) {
        setNutritionTargets(normalizeMacroTargets(local.targets));
      }
      setPreferActivityAdjustedCalories(local?.preferActivityAdjustedCalories ?? false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "display_name, user_tier, measurement_system, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, prefer_activity_adjusted_calories",
        )
        .eq("id", authedUserId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        const local = loadLocalProfile(authedUserId);
        setProfileTier(local?.userTier ?? "free");
        setProfileDisplayName(local?.displayName ?? null);
        setProfileMeasurementSystem(local?.measurementSystem ?? "metric");
        if (local?.targets) {
          setNutritionTargets(normalizeMacroTargets(local.targets));
        }
        setPreferActivityAdjustedCalories(local?.preferActivityAdjustedCalories ?? false);
        return;
      }
      setProfileTier((data?.user_tier as UserTier) ?? "free");
      setProfileDisplayName((data?.display_name as string | null) ?? null);
      const ms = data?.measurement_system === "imperial" ? "imperial" : "metric";
      setProfileMeasurementSystem(ms);
      setPreferActivityAdjustedCalories(Boolean(data?.prefer_activity_adjusted_calories));
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
          setNutritionTargets(normalizeMacroTargets(local.targets));
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
        "display_name, user_tier, measurement_system, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, prefer_activity_adjusted_calories",
      )
      .eq("id", authedUserId)
      .maybeSingle();

    if (error) return;
    setProfileTier((data?.user_tier as UserTier) ?? "free");
    setProfileDisplayName((data?.display_name as string | null) ?? null);
    const ms = data?.measurement_system === "imperial" ? "imperial" : "metric";
    setProfileMeasurementSystem(ms);
    setPreferActivityAdjustedCalories(Boolean(data?.prefer_activity_adjusted_calories));
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
    }
  }, [authedUserId]);

  const redeemPromoCode = useCallback(async (code: string): Promise<RedeemPromoResult> => {
    if (!authedUserId) {
      return { ok: false, error: "not_authenticated" };
    }
    const trimmed = code.trim();
    if (!trimmed) {
      return { ok: false, error: "invalid_code" };
    }
    const { data, error } = await supabase.rpc("redeem_promo_code", { p_code: trimmed });
    if (error) {
      if (looksLikeMissingTableError(error.message ?? "")) {
        return { ok: false, error: "not_deployed", message: error.message };
      }
      return { ok: false, error: "rpc_error", message: error.message };
    }
    const payload = data as {
      ok?: boolean;
      error?: string;
      tier?: string;
      already_redeemed?: boolean;
    } | null;
    if (!payload?.ok) {
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
    const tier = (payload.tier as UserTier) ?? "free";
    setProfileTier(tier);
    return { ok: true, tier, alreadyRedeemed: Boolean(payload.already_redeemed) };
  }, [authedUserId]);

  // Load persisted meal plan from Supabase (nutrition + shopping load in domain hooks).
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      if (dbMealPlanEnabled) {
        const { data, error } = await supabase
          .from("meal_plans")
          .select("plan")
          .eq("user_id", authedUserId)
          .maybeSingle();
        if (!cancelled) {
          if (error) {
            if (looksLikeMissingTableError(error.message ?? "")) {
              setDbMealPlanEnabled(false);
              if (!dbMealPlanWarned) {
                setDbMealPlanWarned(true);
                toast.warning(syncDisabledBecauseSchemaMessage("Meal plan"));
              }
            }
          } else if (data?.plan) {
            const normalized =
              normalizeDayPlans(data.plan) ?? (Array.isArray(data.plan) ? (data.plan as DayPlan[]) : null);
            const slotId = activeMealPlanSlotIdRef.current;
            setMealPlanSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, plan: normalized } : s)));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbMealPlanEnabled, dbMealPlanWarned]);

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
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, title, image_url, servings, is_verified, creator_calories, calories, protein, carbs, fat, fiber_g, created_at, author_id, creator_id, author:profiles(display_name, avatar_url)",
      )
      .eq("published", true)
      .not("author_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return;
    }

    const mapped: RecipeCard[] = (data ?? []).map((row: any) => ({
      id: row.id as string,
      creatorName: (row?.author?.display_name as string | null) ?? "Community",
      creatorImage:
        (row?.author?.avatar_url as string | null) ??
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      title: (row.title as string) ?? "Untitled",
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
    }));

    setUploadedRecipes(mapped);
  }, []);

  useEffect(() => {
    if (!authedUserId) return;
    void refreshDiscoverRecipes();
  }, [authedUserId, refreshDiscoverRecipes]);

  const generateMealPlan = useCallback(
    async (options?: { targetsOverride?: Partial<PlannerTargets>; days?: number }) => {
      const { generatePlanFromLibrary } = await import("../lib/planning/generateMealPlan.ts");
      setIsGeneratingPlan(true);
      try {
        const o = options?.targetsOverride ?? {};
        const targets: PlannerTargets = {
          calories: o.calories ?? nutritionTargets.calories,
          protein: o.protein ?? nutritionTargets.protein,
          carbs: o.carbs ?? nutritionTargets.carbs,
          fat: o.fat ?? nutritionTargets.fat,
          calorieBandPct: o.calorieBandPct ?? DEFAULT_PLANNER_BANDS.calorieBandPct,
          carbFatBandPct: o.carbFatBandPct ?? DEFAULT_PLANNER_BANDS.carbFatBandPct,
        };
        const days = options?.days ?? 1;
        const savedRecipes = savedRecipeIds
          .map((id) => getRecipeById(id) ?? uploadedRecipes.find((r) => r.id === id) ?? null)
          .filter((r): r is NonNullable<typeof r> => Boolean(r));
        if (savedRecipes.length === 0) {
          toast.error("Save at least one recipe from Discover (or your uploads) to generate a macro-aware plan.");
          return;
        }
        const plan = generatePlanFromLibrary({ savedRecipes, targets, days });
        setMealPlan(plan);
        toast.success("Meal plan generated");
        track(AnalyticsEvents.meal_plan_generated, { days });
      } finally {
        setIsGeneratingPlan(false);
      }
    },
    [
      nutritionTargets.calories,
      nutritionTargets.protein,
      nutritionTargets.carbs,
      nutritionTargets.fat,
      savedRecipeIds,
      uploadedRecipes,
    ],
  );

  const generateShoppingListFromPlan = useCallback(async () => {
    const { generateShoppingListFromRecipeEntriesAsync } = await import(
      "../lib/planning/generateShoppingList.ts"
    );
    const titleToId = (title: string) => {
      const r = RECIPE_CATALOG.find((x) => x.title === title);
      if (r) return r.id;
      const u = uploadedRecipes.find((x) => x.title === title);
      return u?.id ?? null;
    };
    const entries = (mealPlan ?? [])
      .flatMap((d) => d.meals)
      .filter((m) => !m.isPlaceholder && m.recipeTitle && titleToId(m.recipeTitle))
      .map((m) => ({
        title: m.recipeTitle,
        multiplier: effectivePortionMultiplier(m.portionMultiplier),
      }));
    const fetchDbIngredients = async (recipeId: string) => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Could not load ingredients for a saved recipe.");
        return [];
      }
      if (!data?.length) return [];
      return data.map((row) => ({
        name: String((row as { name: string }).name ?? ""),
        amount:
          (row as { amount: number | null }).amount != null
            ? String((row as { amount: number | null }).amount)
            : "",
        unit: String((row as { unit: string | null }).unit ?? ""),
      }));
    };
    const list = await generateShoppingListFromRecipeEntriesAsync({
      entries,
      recipeTitleToId: titleToId,
      fetchDbIngredients,
    });
    setShoppingItems(list);
    setShoppingListSourceFingerprint(fingerprintMealPlanForShopping(mealPlan));
    toast.success("Shopping list generated");
    track(AnalyticsEvents.shopping_list_generated, { itemCount: list.length });
  }, [mealPlan, uploadedRecipes]);

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
      const ids = (data ?? []).map((r) => r.recipe_id as string);
      const savedAt: Record<string, string> = {};
      for (const r of data ?? []) {
        savedAt[r.recipe_id as string] = (r.created_at as string) ?? new Date().toISOString();
      }
      setSavedRecipeIds(ids);
      setSavedAtById(savedAt);
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbSavesEnabled, dbSavesWarned]);

  // Persist meal plan to Supabase (debounced), fallback remains local.
  useEffect(() => {
    if (!authedUserId || !dbMealPlanEnabled) return;
    const t = setTimeout(() => {
      supabase
        .from("meal_plans")
        .upsert({ user_id: authedUserId, updated_at: new Date().toISOString(), plan: mealPlan }, { onConflict: "user_id" })
        .then(({ error }) => {
          if (error) {
            const msg = error.message ?? "";
            if (looksLikeMissingTableError(msg)) {
              setDbMealPlanEnabled(false);
              if (!dbMealPlanWarned) {
                setDbMealPlanWarned(true);
                toast.warning(syncDisabledBecauseSchemaMessage("Meal plan"));
              }
              return;
            }
            if (msg.toLowerCase().includes("violates foreign key constraint")) {
              toast.error(
                "Meal plan couldn’t sync—your account session may be out of date. Sign out and sign back in. Your plan is still on this device.",
              );
              return;
            }
            toast.error(syncFailedRetryMessage("meal plan", msg));
          }
        });
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, dbMealPlanEnabled, dbMealPlanWarned, mealPlan]);

  const extraWaterMlForSelectedDay = extraWaterByDay[selectedDateKey] ?? 0;

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
      setExtraWaterByDay((prev) => ({
        ...prev,
        [selectedDateKey]: (prev[selectedDateKey] ?? 0) + add,
      }));
    },
    [selectedDateKey],
  );

  usePersistLocalAppSnapshot({
    savedRecipeIds,
    savedAtById,
    shoppingItems,
    shoppingListSourceFingerprint,
    nutritionByDay,
    mealPlan,
    mealPlanSlots,
    activeMealPlanSlotId,
    nutritionTargets,
    extraWaterByDay,
    activityBurnKcal,
    activityBurnByDay,
  });

  const isRecipeSaved = useCallback(
    (recipeId: string) => savedRecipeIds.includes(recipeId),
    [savedRecipeIds],
  );

  const toggleSaveRecipe = useCallback(
    (recipeId: string, tier: UserTier): boolean => {
      const exists = savedRecipeIds.includes(recipeId);
      if (exists) {
        // optimistic
        setSavedRecipeIds((prev) => prev.filter((id) => id !== recipeId));
        setSavedAtById((prev) => {
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
      // Temporarily: no tier-based save limits (all features unlocked).
      const iso = new Date().toISOString();
      setSavedRecipeIds((prev) => [recipeId, ...prev.filter((id) => id !== recipeId)]);
      setSavedAtById((prev) => ({ ...prev, [recipeId]: iso }));
      track(AnalyticsEvents.recipe_saved, { recipeId });
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
    [savedRecipeIds, authedUserId, dbSavesEnabled, dbSavesWarned],
  );

  const discoverRecipes = useMemo((): RecipeCard[] => {
    const uploaded = uploadedRecipes.map((r) => ({
      ...r,
      isSaved: savedRecipeIds.includes(r.id),
      feedSource: "community" as const,
    }));
    const catalog = RECIPE_CATALOG.map((r) => ({
      ...r,
      isSaved: savedRecipeIds.includes(r.id),
      feedSource: "catalog" as const,
    }));
    return [...uploaded, ...catalog];
  }, [savedRecipeIds, uploadedRecipes]);

  const communityFeedCount = uploadedRecipes.length;

  const savedRecipesForLibrary = useMemo((): Array<RecipeCard & { savedAt: Date }> => {
    const enriched = savedRecipeIds
      .map((id) => {
        const base = getRecipeById(id) ?? uploadedRecipes.find((r) => r.id === id) ?? null;
        if (!base) {
          return null;
        }
        const savedAt = new Date(savedAtById[id] ?? Date.now());
        return { ...base, isSaved: true, savedAt };
      })
      .filter((x): x is RecipeCard & { savedAt: Date } => x !== null);
    enriched.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
    return enriched;
  }, [savedRecipeIds, savedAtById]);

  const value = useMemo(
    (): AppDataContextValue => ({
      authEmail,
      profileDisplayName,
      profileTier,
      refreshProfileBasics,
      profileMeasurementSystem,
      setProfileMeasurementSystem,
      redeemPromoCode,
      signOut,
      generateMealPlan,
      generateShoppingListFromPlan,
      shoppingListOutOfSync,
      discoverRecipes,
      communityFeedCount,
      refreshDiscoverRecipes,
      toggleSaveRecipe,
      isRecipeSaved,
      savedRecipesForLibrary,
      shoppingItems,
      setShoppingItems,
      toggleShoppingChecked,
      removeShoppingItem,
      addShoppingItem,
      nutritionTargets,
      setNutritionTargets,
      preferActivityAdjustedCalories,
      setPreferActivityAdjustedCalories,
      activityBurnKcal,
      setActivityBurnKcal,
      activityBurnForSelectedDay,
      setActivityBurnForSelectedDay,
      addWaterMlForSelectedDay,
      extraWaterMlForSelectedDay,
      extraWaterByDay,
      selectedDateKey,
      setSelectedDateKey,
      mealsForSelectedDate,
      addLoggedMeal,
      addLoggedMealForDate,
      removeLoggedMeal,
      mealPlan,
      setMealPlan,
      mealPlanSlots,
      activeMealPlanSlotId,
      switchMealPlanSlot,
      createMealPlanSlot,
      renameMealPlanSlot,
      deleteMealPlanSlot,
      nutritionByDay,
    }),
    [
      authEmail,
      profileDisplayName,
      profileTier,
      refreshProfileBasics,
      profileMeasurementSystem,
      setProfileMeasurementSystem,
      redeemPromoCode,
      signOut,
      generateMealPlan,
      generateShoppingListFromPlan,
      shoppingListOutOfSync,
      discoverRecipes,
      communityFeedCount,
      refreshDiscoverRecipes,
      toggleSaveRecipe,
      isRecipeSaved,
      savedRecipesForLibrary,
      shoppingItems,
      toggleShoppingChecked,
      removeShoppingItem,
      addShoppingItem,
      nutritionTargets,
      preferActivityAdjustedCalories,
      setPreferActivityAdjustedCalories,
      activityBurnKcal,
      setActivityBurnKcal,
      activityBurnForSelectedDay,
      setActivityBurnForSelectedDay,
      addWaterMlForSelectedDay,
      extraWaterMlForSelectedDay,
      extraWaterByDay,
      mealsForSelectedDate,
      addLoggedMeal,
      addLoggedMealForDate,
      removeLoggedMeal,
      mealPlan,
      mealPlanSlots,
      activeMealPlanSlotId,
      switchMealPlanSlot,
      createMealPlanSlot,
      renameMealPlanSlot,
      deleteMealPlanSlot,
      nutritionByDay,
      selectedDateKey,
      setSelectedDateKey,
      activityBurnByDay,
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
