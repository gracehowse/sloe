import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { getRecipeById, RECIPE_CATALOG } from "../data/recipeCatalog.ts";
import { supabase } from "../lib/supabase/browserClient.ts";
import type { DayPlan, LoggedMeal, RecipeCard, ShoppingItem, UserTier } from "../types/recipe.ts";
import {
  DEFAULT_PLANNER_BANDS,
  type PlannerTargets,
} from "../lib/planning/generateMealPlan.ts";
import { clearLocalProfile, loadLocalProfile } from "../lib/profile/profileStorage.ts";
import { normalizeMacroTargets, type MacroTargets } from "../types/profile.ts";
import { useAuthSession } from "./AuthSessionContext.tsx";
import {
  STORAGE_KEY,
  dateKey,
  defaultSnapshot,
  loadSnapshot,
  newId,
  type PersistedSnapshot,
} from "./appData/persistence.ts";

const FREE_SAVE_LIMIT = 10;

function looksLikeMissingTableError(message: string): boolean {
  const msg = message ?? "";
  return (
    msg.includes("Could not find the table") ||
    msg.toLowerCase().includes("schema cache") ||
    msg.toLowerCase().includes("does not exist")
  );
}

const DEFAULT_UPLOADED_RECIPE_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop";

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
  discoverRecipes: RecipeCard[];
  /** Recipes published by real users (Supabase). Catalog picks are excluded. */
  communityFeedCount: number;
  refreshDiscoverRecipes: () => Promise<void>;
  toggleSaveRecipe: (recipeId: string, tier: UserTier) => void;
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
  /** Placeholder burn (kcal) until Health sync; used for net goal when activity adjustment is on. */
  activityBurnKcal: number;
  setActivityBurnKcal: Dispatch<SetStateAction<number>>;
  /** Quick-add water (ml) for the selected day, in addition to per-meal water. */
  addWaterMlForSelectedDay: (ml: number) => void;
  extraWaterMlForSelectedDay: number;
  selectedDateKey: string;
  setSelectedDateKey: Dispatch<SetStateAction<string>>;
  mealsForSelectedDate: LoggedMeal[];
  addLoggedMeal: (meal: Omit<LoggedMeal, "id">) => void;
  addLoggedMealForDate: (dayKey: string, meal: Omit<LoggedMeal, "id">) => void;
  removeLoggedMeal: (mealId: string) => void;
  mealPlan: DayPlan[] | null;
  setMealPlan: Dispatch<SetStateAction<DayPlan[] | null>>;
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
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(initial.shoppingItems);
  const [nutritionByDay, setNutritionByDay] = useState<Record<string, LoggedMeal[]>>(initial.nutritionByDay);
  const [mealPlan, setMealPlan] = useState<DayPlan[] | null>(initial.mealPlan);
  const [nutritionTargets, setNutritionTargets] = useState(initial.nutritionTargets);
  const [preferActivityAdjustedCalories, setPreferActivityAdjustedCalories] = useState(false);
  const [activityBurnKcal, setActivityBurnKcal] = useState(() => initial.activityBurnKcal ?? 0);
  const [extraWaterByDay, setExtraWaterByDay] = useState<Record<string, number>>(
    () => initial.extraWaterByDay ?? {},
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => dateKey(new Date()));
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profileTier, setProfileTier] = useState<UserTier>("free");
  const [profileMeasurementSystem, setProfileMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [dbSavesEnabled, setDbSavesEnabled] = useState(true);
  const [dbSavesWarned, setDbSavesWarned] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [dbMealPlanEnabled, setDbMealPlanEnabled] = useState(true);
  const [dbMealPlanWarned, setDbMealPlanWarned] = useState(false);
  const [dbNutritionEnabled, setDbNutritionEnabled] = useState(true);
  const [dbNutritionWarned, setDbNutritionWarned] = useState(false);
  const [dbShoppingEnabled, setDbShoppingEnabled] = useState(true);
  const [dbShoppingWarned, setDbShoppingWarned] = useState(false);

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

  const tryEnableDbNutrition = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("nutrition_journals").select("user_id").limit(1);
    if (error) {
      return false;
    }
    setDbNutritionEnabled(true);
    return true;
  }, [authedUserId]);

  const tryEnableDbShopping = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("shopping_lists").select("user_id").limit(1);
    if (error) {
      return false;
    }
    setDbShoppingEnabled(true);
    return true;
  }, [authedUserId]);

  // If we disabled DB saves due to schema cache/table creation timing, keep retrying in the background.
  useEffect(() => {
    if (!authedUserId || dbSavesEnabled) return;
    let cancelled = false;
    const delaysMs = [2000, 5000, 15000, 30000];
    (async () => {
      for (const delay of delaysMs) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        const ok = await tryEnableDbSaves();
        if (ok) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbSavesEnabled, tryEnableDbSaves]);

  useEffect(() => {
    if (!authedUserId || dbMealPlanEnabled) return;
    let cancelled = false;
    const delaysMs = [2000, 5000, 15000, 30000];
    (async () => {
      for (const delay of delaysMs) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        const ok = await tryEnableDbMealPlans();
        if (ok) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbMealPlanEnabled, tryEnableDbMealPlans]);

  useEffect(() => {
    if (!authedUserId || dbNutritionEnabled) return;
    let cancelled = false;
    const delaysMs = [2000, 5000, 15000, 30000];
    (async () => {
      for (const delay of delaysMs) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        const ok = await tryEnableDbNutrition();
        if (ok) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbNutritionEnabled, tryEnableDbNutrition]);

  useEffect(() => {
    if (!authedUserId || dbShoppingEnabled) return;
    let cancelled = false;
    const delaysMs = [2000, 5000, 15000, 30000];
    (async () => {
      for (const delay of delaysMs) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        const ok = await tryEnableDbShopping();
        if (ok) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbShoppingEnabled, tryEnableDbShopping]);

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

  // Load persisted meal plan + nutrition journal from Supabase (fallback stays local).
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
                toast.error("Supabase meal plans not available yet. Using local plan for now.");
              }
            }
          } else if (data?.plan) {
            setMealPlan(data.plan as DayPlan[]);
          }
        }
      }

      if (dbNutritionEnabled) {
        const { data, error } = await supabase
          .from("nutrition_journals")
          .select("by_day")
          .eq("user_id", authedUserId)
          .maybeSingle();
        if (!cancelled) {
          if (error) {
            if (looksLikeMissingTableError(error.message ?? "")) {
              setDbNutritionEnabled(false);
              if (!dbNutritionWarned) {
                setDbNutritionWarned(true);
                toast.error("Supabase nutrition logs not available yet. Using local logs for now.");
              }
            }
          } else if (data?.by_day && typeof data.by_day === "object") {
            setNutritionByDay(data.by_day as Record<string, LoggedMeal[]>);
          }
        }
      }

      if (dbShoppingEnabled) {
        const { data, error } = await supabase
          .from("shopping_lists")
          .select("items")
          .eq("user_id", authedUserId)
          .maybeSingle();
        if (!cancelled) {
          if (error) {
            if (looksLikeMissingTableError(error.message ?? "")) {
              setDbShoppingEnabled(false);
              if (!dbShoppingWarned) {
                setDbShoppingWarned(true);
                toast.error("Supabase shopping list not available yet. Using local list for now.");
              }
            }
          } else if (Array.isArray(data?.items)) {
            setShoppingItems(data.items as ShoppingItem[]);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authedUserId,
    dbMealPlanEnabled,
    dbMealPlanWarned,
    dbNutritionEnabled,
    dbNutritionWarned,
    dbShoppingEnabled,
    dbShoppingWarned,
  ]);

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
        "id, title, image_url, servings, is_verified, creator_calories, calories, protein, carbs, fat, created_at, author:profiles(display_name, avatar_url)",
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
      isVerified: Boolean(row.is_verified),
      creatorCalories: (row.creator_calories as number | null) ?? undefined,
      savedCount: 0,
      isSaved: false,
      feedCreatedAt: row.created_at as string,
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
    const { generateShoppingListFromRecipeTitlesAsync } = await import(
      "../lib/planning/generateShoppingList.ts"
    );
    const titleToId = (title: string) => {
      const r = RECIPE_CATALOG.find((x) => x.title === title);
      if (r) return r.id;
      const u = uploadedRecipes.find((x) => x.title === title);
      return u?.id ?? null;
    };
    const titles = (mealPlan ?? [])
      .flatMap((d) => d.meals)
      .map((m) => m.recipeTitle)
      .filter((t) => Boolean(t && titleToId(t)));
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
    const list = await generateShoppingListFromRecipeTitlesAsync({
      recipeTitles: titles,
      recipeTitleToId: titleToId,
      fetchDbIngredients,
    });
    setShoppingItems(list);
    toast.success("Shopping list generated");
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
            toast.error("Supabase saves table not available yet. Using local saves for now.");
          }
          return;
        }
        toast.error(`Failed to load saved recipes: ${msg}`);
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
                toast.error("Supabase meal plans not available yet. Using local plan for now.");
              }
              return;
            }
            if (msg.toLowerCase().includes("violates foreign key constraint")) {
              toast.error("Meal plan save failed due to account mismatch. Please sign out and sign back in.");
              return;
            }
            toast.error(`Failed to save meal plan: ${msg}`);
          }
        });
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, dbMealPlanEnabled, dbMealPlanWarned, mealPlan]);

  // Persist nutrition journal to Supabase (debounced), fallback remains local.
  useEffect(() => {
    if (!authedUserId || !dbNutritionEnabled) return;
    const t = setTimeout(() => {
      supabase
        .from("nutrition_journals")
        .upsert(
          { user_id: authedUserId, updated_at: new Date().toISOString(), by_day: nutritionByDay },
          { onConflict: "user_id" },
        )
        .then(({ error }) => {
          if (error) {
            const msg = error.message ?? "";
            if (looksLikeMissingTableError(msg)) {
              setDbNutritionEnabled(false);
              if (!dbNutritionWarned) {
                setDbNutritionWarned(true);
                toast.error("Supabase nutrition logs not available yet. Using local logs for now.");
              }
              return;
            }
            if (msg.toLowerCase().includes("violates foreign key constraint")) {
              toast.error("Nutrition log save failed due to account mismatch. Please sign out and sign back in.");
              return;
            }
            toast.error(`Failed to save nutrition logs: ${msg}`);
          }
        });
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, dbNutritionEnabled, dbNutritionWarned, nutritionByDay]);

  // Persist shopping list to Supabase (debounced), fallback remains local.
  useEffect(() => {
    if (!authedUserId || !dbShoppingEnabled) return;
    const t = setTimeout(() => {
      supabase
        .from("shopping_lists")
        .upsert(
          { user_id: authedUserId, updated_at: new Date().toISOString(), items: shoppingItems },
          { onConflict: "user_id" },
        )
        .then(({ error }) => {
          if (error) {
            const msg = error.message ?? "";
            if (looksLikeMissingTableError(msg)) {
              setDbShoppingEnabled(false);
              if (!dbShoppingWarned) {
                setDbShoppingWarned(true);
                toast.error("Supabase shopping list not available yet. Using local list for now.");
              }
              return;
            }
            toast.error(`Failed to save shopping list: ${msg}`);
          }
        });
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, dbShoppingEnabled, dbShoppingWarned, shoppingItems]);

  const extraWaterMlForSelectedDay = extraWaterByDay[selectedDateKey] ?? 0;

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

  useEffect(() => {
    const snapshot: PersistedSnapshot = {
      savedRecipeIds,
      savedAtById,
      shoppingItems,
      nutritionByDay,
      mealPlan,
      nutritionTargets,
      extraWaterByDay,
      activityBurnKcal,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    savedRecipeIds,
    savedAtById,
    shoppingItems,
    nutritionByDay,
    mealPlan,
    nutritionTargets,
    extraWaterByDay,
    activityBurnKcal,
  ]);

  const isRecipeSaved = useCallback(
    (recipeId: string) => savedRecipeIds.includes(recipeId),
    [savedRecipeIds],
  );

  const toggleSaveRecipe = useCallback(
    (recipeId: string, tier: UserTier) => {
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
                if (msg.includes("Could not find the table") || msg.toLowerCase().includes("schema cache")) {
                  setDbSavesEnabled(false);
                  if (!dbSavesWarned) {
                    setDbSavesWarned(true);
                    toast.error("Supabase saves table not available yet. Using local saves for now.");
                  }
                  return;
                }
                toast.error(`Failed to remove save: ${error.message}`);
              } else {
                toast.success("Removed from library");
              }
            });
        } else {
          toast.success("Removed from library");
        }
        return;
      }
      if (tier === "free" && savedRecipeIds.length >= FREE_SAVE_LIMIT) {
        toast.error("Recipe limit reached. Remove a recipe or upgrade to save more.");
        return;
      }
      const iso = new Date().toISOString();
      setSavedRecipeIds((prev) => [recipeId, ...prev.filter((id) => id !== recipeId)]);
      setSavedAtById((prev) => ({ ...prev, [recipeId]: iso }));
      if (authedUserId && dbSavesEnabled) {
        supabase
          .from("saves")
          .insert({ user_id: authedUserId, recipe_id: recipeId })
          .then(({ error }) => {
            if (error) {
              const msg = error.message ?? "";
              if (msg.includes("Could not find the table") || msg.toLowerCase().includes("schema cache")) {
                setDbSavesEnabled(false);
                if (!dbSavesWarned) {
                  setDbSavesWarned(true);
                  toast.error("Supabase saves table not available yet. Using local saves for now.");
                }
                return;
              }
              toast.error(`Failed to save recipe: ${error.message}`);
            } else {
              toast.success("Saved to library");
            }
          });
      } else {
        toast.success("Saved to library");
      }
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

  const mealsForSelectedDate = useMemo(() => {
    return nutritionByDay[selectedDateKey] ?? [];
  }, [nutritionByDay, selectedDateKey]);

  const addLoggedMealForDate = useCallback((dayKey: string, meal: Omit<LoggedMeal, "id">) => {
    const id = newId("meal");
    setNutritionByDay((prev) => {
      const day = prev[dayKey] ?? [];
      return { ...prev, [dayKey]: [...day, { ...meal, id }] };
    });
  }, []);

  const addLoggedMeal = useCallback(
    (meal: Omit<LoggedMeal, "id">) => {
      addLoggedMealForDate(selectedDateKey, meal);
    },
    [addLoggedMealForDate, selectedDateKey],
  );

  const removeLoggedMeal = useCallback(
    (mealId: string) => {
      setNutritionByDay((prev) => ({
        ...prev,
        [selectedDateKey]: (prev[selectedDateKey] ?? []).filter((m) => m.id !== mealId),
      }));
    },
    [selectedDateKey],
  );

  const toggleShoppingChecked = useCallback((itemId: string) => {
    setShoppingItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
    );
  }, []);

  const removeShoppingItem = useCallback((itemId: string) => {
    setShoppingItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const addShoppingItem = useCallback(
    (item: Omit<ShoppingItem, "id" | "checked"> & { checked?: boolean }) => {
      const row: ShoppingItem = {
        ...item,
        id: newId("shop"),
        checked: item.checked ?? false,
      };
      setShoppingItems((prev) => [...prev, row]);
    },
    [],
  );

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
      addWaterMlForSelectedDay,
      extraWaterMlForSelectedDay,
      selectedDateKey,
      setSelectedDateKey,
      mealsForSelectedDate,
      addLoggedMeal,
      addLoggedMealForDate,
      removeLoggedMeal,
      mealPlan,
      setMealPlan,
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
      addWaterMlForSelectedDay,
      extraWaterMlForSelectedDay,
      mealsForSelectedDate,
      addLoggedMeal,
      addLoggedMealForDate,
      removeLoggedMeal,
      mealPlan,
      nutritionByDay,
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
