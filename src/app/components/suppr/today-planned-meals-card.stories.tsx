import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayPlannedMealsCard } from "./today-planned-meals-card";
import type { DayPlanMeal } from "../../../types/recipe.ts";

/**
 * TodayPlannedMealsCard (web) — meal-plan rows for today not yet logged, with
 * the quick portion picker (½× / 1× / 1½× / 2×). Pins the states so Chromatic
 * guards them as a durable regression layer:
 *
 *   - With meals → row list, each with macro line + "Log today" trigger.
 *   - Empty      → same card shell + "Nothing planned" + "Plan your day →"
 *     ghost link (the `today_planned_empty_state` branch, ENG-1065).
 *
 * Mirrors mobile `apps/mobile/components/today/TodayPlannedMealsCard.tsx`.
 */
const MEALS: DayPlanMeal[] = [
  {
    name: "Breakfast",
    recipeTitle: "Greek yogurt bowl",
    calories: 320,
    protein: 28,
    carbs: 34,
    fat: 9,
  },
  {
    name: "Lunch",
    recipeTitle: "Chicken & quinoa salad",
    calories: 540,
    protein: 42,
    carbs: 48,
    fat: 18,
  },
  {
    name: "Dinner",
    recipeTitle: "Salmon traybake",
    calories: 610,
    protein: 46,
    carbs: 40,
    fat: 26,
  },
];

const meta = {
  title: "Suppr/TodayPlannedMealsCard",
  component: TodayPlannedMealsCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    plannedMeals: MEALS,
    onLogPlannedMealWithPortion: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayPlannedMealsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMeals: Story = {
  name: "With planned meals",
  args: { plannedMeals: MEALS },
};

export const Empty: Story = {
  name: "Empty (nothing planned)",
  args: { plannedMeals: [] },
};
