import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MealNutritionDialog } from "./meal-nutrition-dialog";

const SAMPLE_MEAL = {
  id: "meal_1",
  name: "Lunch",
  recipeTitle: "Chicken rice bowl",
  time: "12:45",
  calories: 520,
  protein: 38,
  carbs: 54,
  fat: 14,
  fiberG: 6,
  portionMultiplier: 1,
  micros: {
    vitamin_c_mg: 18,
    iron_mg: 3.2,
    sodium_mg: 640,
    fiberG: 6,
  },
  source: "usda",
};

const meta = {
  title: "Suppr/MealNutritionDialog",
  component: MealNutritionDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Per-meal and per-slot nutrition detail — macro split, micro table, optional edit.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    onMacroTap: () => undefined,
  },
} satisfies Meta<typeof MealNutritionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleMeal: Story = {
  args: {
    meal: SAMPLE_MEAL,
    onEdit: () => undefined,
  },
};

export const SlotAggregate: Story = {
  args: {
    meal: null,
    slotAggregate: {
      slotLabel: "Breakfast",
      meals: [
        {
          id: "m1",
          name: "Breakfast",
          recipeTitle: "Oatmeal",
          calories: 320,
          protein: 12,
          carbs: 48,
          fat: 8,
          fiberG: 5,
          micros: { fiberG: 5 },
          source: "manual",
        },
        {
          id: "m2",
          name: "Breakfast",
          recipeTitle: "Blueberries",
          calories: 60,
          protein: 1,
          carbs: 14,
          fat: 0,
          source: "off",
        },
      ],
    },
  },
};
