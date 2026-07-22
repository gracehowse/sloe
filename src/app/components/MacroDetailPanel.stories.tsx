import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MacroDetailPanel, type MacroMeal } from "./MacroDetailPanel";

const SAMPLE_MEALS: MacroMeal[] = [
  {
    id: "meal-1",
    name: "Breakfast",
    recipeTitle: "Greek yogurt bowl",
    protein: 28,
    carbs: 34,
    fat: 9,
    fiberG: 6,
    calories: 320,
    recipeId: "recipe-yogurt",
    portionMultiplier: 1,
  },
  {
    id: "meal-2",
    name: "Lunch",
    recipeTitle: "Chicken rice bowl",
    protein: 42,
    carbs: 58,
    fat: 14,
    fiberG: 4,
    calories: 540,
    recipeId: "recipe-chicken",
    portionMultiplier: 1,
  },
];

const SAMPLE_INGREDIENT_ROWS = [
  {
    recipeId: "recipe-chicken",
    name: "Chicken breast",
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiberG: 0,
    calories: 165,
  },
  {
    recipeId: "recipe-chicken",
    name: "Jasmine rice",
    protein: 4,
    carbs: 45,
    fat: 0.4,
    fiberG: 0.6,
    calories: 205,
  },
];

const meta = {
  title: "Host/MacroDetailPanel",
  component: MacroDetailPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "Per-macro breakdown dialog — By meal / By ingredient toggle with empty-state CTA.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    macro: "protein",
    meals: SAMPLE_MEALS,
    ingredientRows: SAMPLE_INGREDIENT_ROWS,
  },
} satisfies Meta<typeof MacroDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProteinByMeal: Story = {
  name: "Protein · By meal",
  args: {
    macro: "protein",
    meals: SAMPLE_MEALS,
  },
};

export const CarbsByMeal: Story = {
  name: "Carbs · By meal",
  args: {
    macro: "carbs",
    meals: SAMPLE_MEALS,
    ingredientRows: SAMPLE_INGREDIENT_ROWS,
  },
};

export const Empty: Story = {
  args: {
    macro: "fiber",
    meals: [],
    ingredientRows: [],
  },
};

export const WaterPinnedToMeal: Story = {
  name: "Water (meal-only)",
  args: {
    macro: "water",
    meals: [
      {
        id: "water-1",
        name: "Quick add",
        recipeTitle: "Water",
        waterMl: 750,
      },
    ],
  },
};
