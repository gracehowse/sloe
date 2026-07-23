import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanPortionDialog } from "./plan-portion-dialog";
import type { DayPlan } from "../../../types/recipe";

const SAMPLE_PLAN: DayPlan[] = [
  {
    day: 3,
    meals: [
      {
        name: "Dinner",
        recipeTitle: "Beef stir fry",
        recipeId: "r_stir_fry",
        calories: 540,
        protein: 32,
        carbs: 48,
        fat: 22,
        portionMultiplier: 1,
      },
    ],
    totals: { calories: 540, protein: 32, carbs: 48, fat: 22 },
  },
];

const meta = {
  title: "Suppr/PlanPortionDialog",
  component: PlanPortionDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Choose a portion multiplier for a planner row.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    plan: SAMPLE_PLAN,
    target: { day: 3, mealIndex: 0 },
    recipePool: [{ id: "r_stir_fry", title: "Beef stir fry", calories: 540 }],
    onSelect: () => undefined,
  },
} satisfies Meta<typeof PlanPortionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DoublePortionSelected: Story = {
  args: {
    plan: [
      {
        day: 3,
        meals: [
          {
            name: "Dinner",
            recipeTitle: "Beef stir fry",
            recipeId: "r_stir_fry",
            calories: 1080,
            protein: 64,
            carbs: 96,
            fat: 44,
            portionMultiplier: 2,
          },
        ],
        totals: { calories: 1080, protein: 64, carbs: 96, fat: 44 },
      },
    ],
  },
};
