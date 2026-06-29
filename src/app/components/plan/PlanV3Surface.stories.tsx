import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { computePlanWeekVerdict } from "@/lib/planning/planWeekStatus";
import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import type { DayPlan, DayPlanMeal } from "@/types/recipe";
import { PlanV3Surface } from "./PlanV3Surface";

/**
 * PlanV3Surface — the Sloe v3 Plan surface (web parity of the SEE-validated
 * mobile Plan, ENG-1225). Pinned states for the mobile-web single column:
 * a populated mixed week (full/partial/empty days) and a fresh empty week.
 */
const meal = (
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

const placeholder = (slot: string): DayPlanMeal =>
  meal(slot, 0, { recipeTitle: "", isPlaceholder: true });

const fullDay = (day: number, names: [string, string, string, string]): DayPlan => {
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

const partialDay = (day: number): DayPlan => ({
  day,
  meals: [
    meal("Greek yoghurt bowl", 380),
    meal("Chicken salad", 510),
    placeholder("Dinner"),
    placeholder("Snacks"),
  ],
  totals: { calories: 890, protein: 71, carbs: 89, fat: 36 },
});

const emptyDay = (day: number): DayPlan => ({
  day,
  meals: ALL_MEAL_SLOTS.map((s) => placeholder(s)),
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

const week: DayPlan[] = [
  fullDay(0, ["Oats & berries", "Tahini grain bowl", "Miso salmon", "Apple"]),
  fullDay(1, ["Eggs & avocado", "Burrito bowl", "Chicken traybake", "Yoghurt"]),
  partialDay(2),
  fullDay(3, ["Smoothie", "Poke bowl", "Sunday roast", "Dark chocolate"]),
  fullDay(4, ["Shakshuka", "Lentil soup", "Steak & greens", "Nuts"]),
  emptyDay(5),
  emptyDay(6),
];
const emptyWeek: DayPlan[] = Array.from({ length: 7 }, (_, i) => emptyDay(i));

// Week of Mon 15 Jun 2026 → Sun 21; today = Thu 18 (index 3).
const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 15 + i));
const today = new Date(2026, 5, 18);

const verdictFor = (plan: DayPlan[]) =>
  computePlanWeekVerdict(
    plan.map((dp) =>
      dp.meals.map((m, i) => ({
        slot: ALL_MEAL_SLOTS[i] ?? "Snacks",
        kcal: m.calories,
        empty: m.isPlaceholder,
      })),
    ),
  );

const noop = () => {};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 390, background: "var(--bg)", padding: 20, borderRadius: 24 }}>
      {children}
    </div>
  );
}

const meta = {
  title: "Plan/PlanV3Surface",
  component: PlanV3Surface,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <Frame><Story /></Frame>],
  args: {
    plan: week,
    targetKcal: 1830,
    weekDates,
    weekLabel: "15–21 June",
    verdict: verdictFor(week),
    household: null,
    onGenerate: noop,
    onAdjust: noop,
    onTemplates: noop,
    onOpenHousehold: noop,
    onOpenMeal: noop,
    onAddToSlot: noop,
    shoppingItemCount: 23,
    servingCount: 2,
    onOpenShopping: noop,
    onOpenBatchCook: noop,
    batchCookSubtitle: "Cook once · scale shopping",
    today,
  },
} satisfies Meta<typeof PlanV3Surface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PopulatedWeek: Story = {
  name: "Populated week (mixed)",
};

export const FreshWeek: Story = {
  name: "Fresh week (all empty)",
  args: {
    plan: emptyWeek,
    verdict: verdictFor(emptyWeek),
    shoppingItemCount: 0,
    servingCount: 1,
  },
};
