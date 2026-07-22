import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeVerifyModal } from "./recipe-verify-modal";
import type { IngredientRow } from "../../../types/recipe";

function makeRow(partial: Partial<IngredientRow>): IngredientRow {
  return {
    name: "Ingredient",
    amount: "1",
    unit: "g",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    isVerified: false,
    source: "AI",
    ...partial,
  };
}

const INGREDIENTS: IngredientRow[] = [
  makeRow({ name: "Chicken thighs", amount: "450", unit: "g", isVerified: true, source: "USDA", confidence: 1 }),
  makeRow({ name: "Sun-dried tomatoes", amount: "100", unit: "g", isVerified: false, source: "AI", confidence: 0.6 }),
  makeRow({ name: "Parmesan", amount: "40", unit: "g", isVerified: false, source: "AI", confidence: 0.3 }),
];

const meta = {
  title: "Suppr/RecipeVerifyModal",
  component: RecipeVerifyModal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Import-review verify modal — shared tier derivation with inline ingredient rows.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    recipeName: "Creamy tuscan chicken",
    ingredients: INGREDIENTS,
    ingredientIds: INGREDIENTS.map((_, i) => `ing-${i}`),
    servings: 4,
    baseServings: 4,
    onFixRow: () => undefined,
    onCalculate: () => undefined,
  },
} satisfies Meta<typeof RecipeVerifyModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedRows: Story = {
  name: "Mixed tiers",
};

export const EmptyList: Story = {
  name: "Empty ingredient list",
  args: {
    ingredients: [],
    ingredientIds: [],
  },
};
