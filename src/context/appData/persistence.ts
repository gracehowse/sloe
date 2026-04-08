import { normalizeDayPlans } from "../../lib/nutrition/portionMultiplier.ts";
import type { DayPlan, LoggedMeal, ShoppingItem } from "../../types/recipe.ts";
import { DEFAULT_MACRO_TARGETS, normalizeMacroTargets, type MacroTargets } from "../../types/profile.ts";

export const STORAGE_KEY = "platemate-app-v1";

export interface PersistedSnapshot {
  savedRecipeIds: string[];
  savedAtById: Record<string, string>;
  shoppingItems: ShoppingItem[];
  nutritionByDay: Record<string, LoggedMeal[]>;
  mealPlan: DayPlan[] | null;
  nutritionTargets: MacroTargets;
  extraWaterByDay?: Record<string, number>;
  activityBurnKcal?: number;
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeLoggedMealRow(m: unknown): LoggedMeal | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Partial<LoggedMeal>;
  if (typeof o.id !== "string") return null;
  return {
    id: o.id,
    name: typeof o.name === "string" ? o.name : "Meal",
    recipeTitle: typeof o.recipeTitle === "string" ? o.recipeTitle : "",
    time: typeof o.time === "string" ? o.time : "",
    calories: Math.max(0, Math.round(Number(o.calories) || 0)),
    protein: Math.max(0, Math.round(Number(o.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(o.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(o.fat) || 0)),
    ...(typeof o.fiberG === "number" && Number.isFinite(o.fiberG) ? { fiberG: Math.max(0, Math.round(o.fiberG)) } : {}),
    ...(typeof o.waterMl === "number" && Number.isFinite(o.waterMl) ? { waterMl: Math.max(0, Math.round(o.waterMl)) } : {}),
    ...(typeof o.portionMultiplier === "number" &&
    Number.isFinite(o.portionMultiplier) &&
    o.portionMultiplier > 0
      ? {
          portionMultiplier: Math.min(8, Math.max(0.5, Math.round(o.portionMultiplier * 2) / 2)),
        }
      : {}),
  };
}

export function defaultSnapshot(): PersistedSnapshot {
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
    nutritionTargets: { ...DEFAULT_MACRO_TARGETS },
  };
}

export function loadSnapshot(): PersistedSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSnapshot();
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    const base = defaultSnapshot();
    let nutritionByDay = base.nutritionByDay;
    if (parsed.nutritionByDay && typeof parsed.nutritionByDay === "object") {
      const next: Record<string, LoggedMeal[]> = {};
      for (const [k, day] of Object.entries(parsed.nutritionByDay)) {
        if (!Array.isArray(day)) continue;
        next[k] = day.map((row) => normalizeLoggedMealRow(row)).filter((x): x is LoggedMeal => Boolean(x));
      }
      nutritionByDay = next;
    }
    let mealPlan: DayPlan[] | null = base.mealPlan;
    if (parsed.mealPlan === null) {
      mealPlan = null;
    } else if (Array.isArray(parsed.mealPlan)) {
      mealPlan = normalizeDayPlans(parsed.mealPlan) ?? base.mealPlan;
    }

    return {
      savedRecipeIds: Array.isArray(parsed.savedRecipeIds) ? parsed.savedRecipeIds : base.savedRecipeIds,
      savedAtById:
        parsed.savedAtById && typeof parsed.savedAtById === "object"
          ? { ...base.savedAtById, ...parsed.savedAtById }
          : base.savedAtById,
      shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : base.shoppingItems,
      nutritionByDay,
      mealPlan,
      nutritionTargets: normalizeMacroTargets(parsed.nutritionTargets ?? base.nutritionTargets),
      extraWaterByDay:
        parsed.extraWaterByDay && typeof parsed.extraWaterByDay === "object"
          ? parsed.extraWaterByDay
          : undefined,
      activityBurnKcal:
        typeof parsed.activityBurnKcal === "number" && Number.isFinite(parsed.activityBurnKcal)
          ? Math.max(0, Math.round(parsed.activityBurnKcal))
          : undefined,
    };
  } catch {
    return defaultSnapshot();
  }
}
