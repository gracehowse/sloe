import type { ReactNode } from "react";

import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import { computePlanWeekVerdict } from "@/lib/planning/planWeekStatus";
import type { DayPlan, DayPlanMeal } from "@/types/recipe";

export const noop = () => undefined;

export const meal = (
  name: string,
  calories: number,
  opts: Partial<DayPlanMeal> = {},
): DayPlanMeal => ({
  name,
  recipeTitle: name,
  calories,
  protein: Math.round(calories * 0.08),
  carbs: Math.round(calories * 0.1),
  fat: Math.round(calories * 0.04),
  ...opts,
});

export const placeholder = (slot: string): DayPlanMeal =>
  meal(slot, 0, { recipeTitle: "", isPlaceholder: true });

export const fullDay = (day: number, names: [string, string, string, string]): DayPlan => {
  const meals = [
    meal(names[0], 420),
    meal(names[1], 540, { isLocked: day === 3 }),
    meal(names[2], 610),
    meal(names[3], 180),
  ];
  const totals = meals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { day, meals, totals };
};

export const partialDay = (day: number): DayPlan => ({
  day,
  meals: [
    meal("Greek yoghurt bowl", 380),
    meal("Chicken salad", 510),
    placeholder("Dinner"),
    placeholder("Snacks"),
  ],
  totals: { calories: 890, protein: 71, carbs: 89, fat: 36 },
});

export const emptyDay = (day: number): DayPlan => ({
  day,
  meals: ALL_MEAL_SLOTS.map((s) => placeholder(s)),
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

export const sampleWeek: DayPlan[] = [
  fullDay(0, ["Oats & berries", "Tahini grain bowl", "Miso salmon", "Apple"]),
  fullDay(1, ["Eggs & avocado", "Burrito bowl", "Chicken traybake", "Yoghurt"]),
  partialDay(2),
  fullDay(3, ["Smoothie", "Poke bowl", "Sunday roast", "Dark chocolate"]),
  fullDay(4, ["Shakshuka", "Lentil soup", "Steak & greens", "Nuts"]),
  emptyDay(5),
  emptyDay(6),
];

export const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 15 + i));
export const today = new Date(2026, 5, 18);

export const verdictFor = (plan: DayPlan[]) =>
  computePlanWeekVerdict(
    plan.map((dp) =>
      dp.meals.map((m, i) => ({
        slot: ALL_MEAL_SLOTS[i] ?? "Snacks",
        kcal: m.calories,
        empty: m.isPlaceholder,
      })),
    ),
  );

export function PlanMobileFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 390, background: "var(--bg)", padding: 20, borderRadius: 24 }}>
      {children}
    </div>
  );
}
