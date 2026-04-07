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
import { clearLocalProfile, loadLocalProfile } from "../lib/profile/profileStorage.ts";

const STORAGE_KEY = "platemate-app-v1";
const FREE_SAVE_LIMIT = 10;

function looksLikeMissingTableError(message: string): boolean {
  const msg = message ?? "";
  return (
    msg.includes("Could not find the table") ||
    msg.toLowerCase().includes("schema cache") ||
    msg.toLowerCase().includes("does not exist")
  );
}

interface PersistedSnapshot {
  savedRecipeIds: string[];
  savedAtById: Record<string, string>;
  shoppingItems: ShoppingItem[];
  nutritionByDay: Record<string, LoggedMeal[]>;
  mealPlan: DayPlan[] | null;
  nutritionTargets: { calories: number; protein: number; carbs: number; fat: number };
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultSnapshot(): PersistedSnapshot {
  const today = dateKey(new Date());
  const initialMeals: LoggedMeal[] = [
    {
      id: "seed-breakfast",
      name: "Breakfast",
      recipeTitle: "Overnight Protein Oats",
      time: "8:30 AM",
      calories: 387,
      protein: 32,
      carbs: 48,
      fat: 8,
    },
    {
      id: "seed-lunch",
      name: "Lunch",
      recipeTitle: "High-Protein Chicken & Rice Bowl",
      time: "12:45 PM",
      calories: 542,
      protein: 48,
      carbs: 52,
      fat: 12,
    },
  ];
  return {
    savedRecipeIds: [
      "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "dddddddd-dddd-dddd-dddd-dddddddddddd",
    ],
    savedAtById: {
      "cccccccc-cccc-cccc-cccc-cccccccccccc": new Date("2026-04-05").toISOString(),
      "dddddddd-dddd-dddd-dddd-dddddddddddd": new Date("2026-04-03").toISOString(),
    },
    shoppingItems: [
      {
        id: "1",
        name: "Chicken Breast",
        amount: "1.5",
        unit: "lb",
        category: "Protein",
        checked: false,
        from: "High-Protein Chicken Bowl",
      },
      {
        id: "2",
        name: "Brown Rice",
        amount: "2",
        unit: "cups",
        category: "Grains",
        checked: false,
        from: "High-Protein Chicken Bowl",
      },
      {
        id: "3",
        name: "Broccoli",
        amount: "1",
        unit: "head",
        category: "Vegetables",
        checked: false,
        from: "High-Protein Chicken Bowl",
      },
      {
        id: "4",
        name: "Rolled Oats",
        amount: "1",
        unit: "cup",
        category: "Grains",
        checked: false,
        from: "Overnight Protein Oats",
      },
      {
        id: "5",
        name: "Protein Powder",
        amount: "2",
        unit: "scoops",
        category: "Protein",
        checked: true,
        from: "Overnight Protein Oats",
      },
      {
        id: "6",
        name: "Almond Milk",
        amount: "1",
        unit: "cup",
        category: "Dairy",
        checked: true,
        from: "Overnight Protein Oats",
      },
      {
        id: "7",
        name: "Salmon Fillet",
        amount: "8",
        unit: "oz",
        category: "Protein",
        checked: false,
        from: "Grilled Salmon",
      },
      {
        id: "8",
        name: "Sweet Potato",
        amount: "2",
        unit: "medium",
        category: "Vegetables",
        checked: false,
        from: "Grilled Salmon",
      },
      {
        id: "9",
        name: "Olive Oil",
        amount: "2",
        unit: "tbsp",
        category: "Oils",
        checked: false,
        from: "Multiple recipes",
      },
    ],
    nutritionByDay: { [today]: initialMeals },
    mealPlan: null,
    nutritionTargets: { calories: 1400, protein: 120, carbs: 150, fat: 40 },
  };
}

function loadSnapshot(): PersistedSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSnapshot();
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    const base = defaultSnapshot();
    return {
      savedRecipeIds: Array.isArray(parsed.savedRecipeIds) ? parsed.savedRecipeIds : base.savedRecipeIds,
      savedAtById:
        parsed.savedAtById && typeof parsed.savedAtById === "object"
          ? { ...base.savedAtById, ...parsed.savedAtById }
          : base.savedAtById,
      shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : base.shoppingItems,
      nutritionByDay:
        parsed.nutritionByDay && typeof parsed.nutritionByDay === "object"
          ? parsed.nutritionByDay
          : base.nutritionByDay,
      mealPlan: parsed.mealPlan === null || Array.isArray(parsed.mealPlan) ? parsed.mealPlan : base.mealPlan,
      nutritionTargets: parsed.nutritionTargets
        ? { ...base.nutritionTargets, ...parsed.nutritionTargets }
        : base.nutritionTargets,
    };
  } catch {
    return defaultSnapshot();
  }
}

interface AppDataContextValue {
  authEmail: string | null;
  profileDisplayName: string | null;
  profileTier: UserTier;
  signOut: () => Promise<void>;
  generateMealPlan: (options?: {
    targetsOverride?: { calories: number; protein: number };
    days?: number;
  }) => Promise<void>;
  generateShoppingListFromPlan: () => Promise<void>;
  discoverRecipes: RecipeCard[];
  toggleSaveRecipe: (recipeId: string, tier: UserTier) => void;
  isRecipeSaved: (recipeId: string) => boolean;
  savedRecipesForLibrary: Array<RecipeCard & { savedAt: Date }>;
  shoppingItems: ShoppingItem[];
  setShoppingItems: Dispatch<SetStateAction<ShoppingItem[]>>;
  toggleShoppingChecked: (itemId: string) => void;
  removeShoppingItem: (itemId: string) => void;
  addShoppingItem: (item: Omit<ShoppingItem, "id" | "checked"> & { checked?: boolean }) => void;
  nutritionTargets: { calories: number; protein: number; carbs: number; fat: number };
  setNutritionTargets: Dispatch<
    SetStateAction<{ calories: number; protein: number; carbs: number; fat: number }>
  >;
  selectedDateKey: string;
  setSelectedDateKey: Dispatch<SetStateAction<string>>;
  mealsForSelectedDate: LoggedMeal[];
  addLoggedMeal: (meal: Omit<LoggedMeal, "id">) => void;
  addLoggedMealForDate: (dayKey: string, meal: Omit<LoggedMeal, "id">) => void;
  removeLoggedMeal: (mealId: string) => void;
  mealPlan: DayPlan[] | null;
  setMealPlan: Dispatch<SetStateAction<DayPlan[] | null>>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadSnapshot(), []);

  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>(initial.savedRecipeIds);
  const [savedAtById, setSavedAtById] = useState<Record<string, string>>(initial.savedAtById);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(initial.shoppingItems);
  const [nutritionByDay, setNutritionByDay] = useState<Record<string, LoggedMeal[]>>(initial.nutritionByDay);
  const [mealPlan, setMealPlan] = useState<DayPlan[] | null>(initial.mealPlan);
  const [nutritionTargets, setNutritionTargets] = useState(initial.nutritionTargets);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => dateKey(new Date()));
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profileTier, setProfileTier] = useState<UserTier>("free");
  const [dbSavesEnabled, setDbSavesEnabled] = useState(true);
  const [dbSavesWarned, setDbSavesWarned] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [dbMealPlanEnabled, setDbMealPlanEnabled] = useState(true);
  const [dbMealPlanWarned, setDbMealPlanWarned] = useState(false);
  const [dbNutritionEnabled, setDbNutritionEnabled] = useState(true);
  const [dbNutritionWarned, setDbNutritionWarned] = useState(false);

  const tryEnableDbSaves = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("saves").select("recipe_id").limit(1);
    if (error) {
      return false;
    }
    setDbSavesEnabled(true);
    toast.success("Supabase saves reconnected");
    return true;
  }, [authedUserId]);

  const tryEnableDbMealPlans = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("meal_plans").select("user_id").limit(1);
    if (error) {
      return false;
    }
    setDbMealPlanEnabled(true);
    toast.success("Supabase meal plans reconnected");
    return true;
  }, [authedUserId]);

  const tryEnableDbNutrition = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("nutrition_journals").select("user_id").limit(1);
    if (error) {
      return false;
    }
    setDbNutritionEnabled(true);
    toast.success("Supabase nutrition logs reconnected");
    return true;
  }, [authedUserId]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) {
        return;
      }
      setAuthedUserId(data.session?.user.id ?? null);
      setAuthEmail(data.session?.user.email ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthedUserId(session?.user.id ?? null);
      setAuthEmail(session?.user.email ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

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

  // Load profile basics (tier/display name). Falls back to local profile if needed.
  useEffect(() => {
    if (!authedUserId) {
      const local = loadLocalProfile(null);
      setProfileTier(local?.userTier ?? "free");
      setProfileDisplayName(local?.displayName ?? null);
      if (local?.targets) {
        setNutritionTargets(local.targets);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "display_name, user_tier, target_calories, target_protein, target_carbs, target_fat",
        )
        .eq("id", authedUserId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        const local = loadLocalProfile(authedUserId);
        setProfileTier(local?.userTier ?? "free");
        setProfileDisplayName(local?.displayName ?? null);
        if (local?.targets) {
          setNutritionTargets(local.targets);
        }
        return;
      }
      setProfileTier((data?.user_tier as UserTier) ?? "free");
      setProfileDisplayName((data?.display_name as string | null) ?? null);
      const hasTargets = Boolean(
        data?.target_calories &&
          data?.target_protein &&
          data?.target_carbs &&
          data?.target_fat,
      );
      if (hasTargets) {
        setNutritionTargets({
          calories: data!.target_calories as number,
          protein: data!.target_protein as number,
          carbs: data!.target_carbs as number,
          fat: data!.target_fat as number,
        });
      } else {
        const local = loadLocalProfile(authedUserId);
        if (local?.targets) {
          setNutritionTargets(local.targets);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbMealPlanEnabled, dbMealPlanWarned, dbNutritionEnabled, dbNutritionWarned]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    clearLocalProfile();
    window.location.href = "/login";
  }, []);

  const generateMealPlan = useCallback(
    async (options?: { targetsOverride?: { calories: number; protein: number }; days?: number }) => {
      const { generatePlanFromLibrary } = await import("../lib/planning/generateMealPlan.ts");
      setIsGeneratingPlan(true);
      try {
        const targets = options?.targetsOverride ?? {
          calories: nutritionTargets.calories,
          protein: nutritionTargets.protein,
        };
        const days = options?.days ?? 1;
        const savedRecipes = savedRecipeIds
          .map((id) => getRecipeById(id))
          .filter((r): r is NonNullable<typeof r> => Boolean(r));
        const plan = generatePlanFromLibrary({ savedRecipes, targets, days });
        setMealPlan(plan);
        toast.success("Meal plan generated");
      } finally {
        setIsGeneratingPlan(false);
      }
    },
    [nutritionTargets.calories, nutritionTargets.protein, savedRecipeIds],
  );

  const generateShoppingListFromPlan = useCallback(async () => {
    const { generateShoppingListFromRecipeTitles } = await import(
      "../lib/planning/generateShoppingList.ts"
    );
    const titleToId = (title: string) => {
      const r = RECIPE_CATALOG.find((x) => x.title === title);
      return r?.id ?? null;
    };
    const titles = (mealPlan ?? [])
      .flatMap((d) => d.meals)
      .map((m) => m.recipeTitle)
      .filter((t) => Boolean(t && titleToId(t)));
    const list = generateShoppingListFromRecipeTitles({ recipeTitles: titles, recipeTitleToId: titleToId });
    setShoppingItems(list);
    toast.success("Shopping list generated");
  }, [mealPlan]);

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

  useEffect(() => {
    const snapshot: PersistedSnapshot = {
      savedRecipeIds,
      savedAtById,
      shoppingItems,
      nutritionByDay,
      mealPlan,
      nutritionTargets,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [savedRecipeIds, savedAtById, shoppingItems, nutritionByDay, mealPlan, nutritionTargets]);

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
    return RECIPE_CATALOG.map((r) => ({
      ...r,
      isSaved: savedRecipeIds.includes(r.id),
    }));
  }, [savedRecipeIds]);

  const savedRecipesForLibrary = useMemo((): Array<RecipeCard & { savedAt: Date }> => {
    const enriched = savedRecipeIds
      .map((id) => {
        const base = getRecipeById(id);
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
      signOut,
      generateMealPlan,
      generateShoppingListFromPlan,
      discoverRecipes,
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
      selectedDateKey,
      setSelectedDateKey,
      mealsForSelectedDate,
      addLoggedMeal,
      addLoggedMealForDate,
      removeLoggedMeal,
      mealPlan,
      setMealPlan,
    }),
    [
      authEmail,
      profileDisplayName,
      profileTier,
      signOut,
      generateMealPlan,
      generateShoppingListFromPlan,
      discoverRecipes,
      toggleSaveRecipe,
      isRecipeSaved,
      savedRecipesForLibrary,
      shoppingItems,
      toggleShoppingChecked,
      removeShoppingItem,
      addShoppingItem,
      nutritionTargets,
      mealsForSelectedDate,
      addLoggedMeal,
      addLoggedMealForDate,
      removeLoggedMeal,
      mealPlan,
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
