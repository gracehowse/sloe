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
import type { DayPlan, LoggedMeal, RecipeCard, ShoppingItem, UserTier } from "../types/recipe.ts";

const STORAGE_KEY = "platemate-app-v1";
const FREE_SAVE_LIMIT = 10;

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
    savedRecipeIds: ["3", "4"],
    savedAtById: {
      "3": new Date("2026-04-05").toISOString(),
      "4": new Date("2026-04-03").toISOString(),
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
        setSavedRecipeIds((prev) => prev.filter((id) => id !== recipeId));
        setSavedAtById((prev) => {
          const next = { ...prev };
          delete next[recipeId];
          return next;
        });
        toast.success("Removed from library");
        return;
      }
      if (tier === "free" && savedRecipeIds.length >= FREE_SAVE_LIMIT) {
        toast.error("Recipe limit reached. Remove a recipe or upgrade to save more.");
        return;
      }
      const iso = new Date().toISOString();
      setSavedRecipeIds((prev) => [recipeId, ...prev.filter((id) => id !== recipeId)]);
      setSavedAtById((prev) => ({ ...prev, [recipeId]: iso }));
      toast.success("Saved to library");
    },
    [savedRecipeIds],
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

  const addLoggedMeal = useCallback((meal: Omit<LoggedMeal, "id">) => {
    const id = newId("meal");
    setNutritionByDay((prev) => {
      const day = prev[selectedDateKey] ?? [];
      return { ...prev, [selectedDateKey]: [...day, { ...meal, id }] };
    });
  }, [selectedDateKey]);

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
      removeLoggedMeal,
      mealPlan,
      setMealPlan,
    }),
    [
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
