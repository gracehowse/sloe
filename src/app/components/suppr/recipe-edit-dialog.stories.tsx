import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeEditDialog } from "./recipe-edit-dialog";
import type { IngredientRow } from "../../../types/recipe";

const INGREDIENTS: IngredientRow[] = [
  {
    name: "Chicken thighs",
    amount: "450",
    unit: "g",
    calories: 720,
    protein: 84,
    carbs: 0,
    fat: 40,
    isVerified: true,
    source: "USDA",
  },
  {
    name: "Olive oil",
    amount: "15",
    unit: "ml",
    calories: 120,
    protein: 0,
    carbs: 0,
    fat: 14,
    isVerified: true,
    source: "USDA",
  },
];

const meta = {
  title: "Suppr/RecipeEditDialog",
  component: RecipeEditDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Recipe metadata editor — title, servings, meal types, times, instructions. Save writes to the database (not exercised in Storybook).",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    recipeId: "00000000-0000-4000-8000-000000000001",
    authorId: "00000000-0000-4000-8000-000000000002",
    initial: {
      title: "Miso salmon bowl",
      description: "Quick weeknight bowl with ginger miso dressing.",
      instructions: "1. Cook rice.\n2. Pan-sear salmon.\n3. Whisk miso dressing.",
      servings: 2,
      meal_type: ["dinner"],
      prep_time_min: 15,
      cook_time_min: 20,
      yield: null,
    },
    ingredients: INGREDIENTS,
    onSaved: () => undefined,
  },
} satisfies Meta<typeof RecipeEditDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBatchYield: Story = {
  name: "With batch yield",
  args: {
    initial: {
      title: "Banana bread",
      description: null,
      instructions: "Mix, bake 45 min at 175°C.",
      servings: 12,
      meal_type: ["snack"],
      prep_time_min: 10,
      cook_time_min: 45,
      yield: {
        kind: "weight_and_units",
        totalGrams: 680,
        unitCount: 12,
        singular: "slice",
        plural: "slices",
      },
    },
  },
};
