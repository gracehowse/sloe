import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanMoveMealDialog } from "./plan-move-meal-dialog";
import type { DayPlan } from "../../../types/recipe";

const meal = (
  name: string,
  recipeTitle: string,
  calories: number,
  placeholder = false,
) => ({
  name,
  recipeTitle,
  calories,
  protein: 20,
  carbs: 30,
  fat: 10,
  isPlaceholder: placeholder,
});

const SAMPLE_PLAN: DayPlan[] = [
  {
    day: 1,
    meals: [
      meal("Breakfast", "Overnight oats", 380),
      meal("Lunch", "", 0, true),
      meal("Dinner", "Salmon tray bake", 620),
    ],
    totals: { calories: 1000, protein: 60, carbs: 90, fat: 35 },
  },
  {
    day: 2,
    meals: [
      meal("Breakfast", "", 0, true),
      meal("Lunch", "Chicken salad", 450),
      meal("Dinner", "", 0, true),
    ],
    totals: { calories: 450, protein: 35, carbs: 40, fat: 18 },
  },
];

const meta = {
  title: "Suppr/PlanMoveMealDialog",
  component: PlanMoveMealDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Pick a destination slot when moving a meal within the week plan.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    plan: SAMPLE_PLAN,
    dayLabels: ["Mon 15", "Tue 16"],
    onMove: () => undefined,
  },
} satisfies Meta<typeof PlanMoveMealDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FromBreakfast: Story = {
  args: {
    from: { day: 1, slotIndex: 0 },
  },
};

export const FromEmptySlot: Story = {
  args: {
    from: { day: 1, slotIndex: 1 },
  },
};
