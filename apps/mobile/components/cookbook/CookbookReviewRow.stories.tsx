import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { CookbookReviewRow } from "./CookbookReviewRow";
import type { PlanImportVerifiedRecipe } from "@suppr/shared/planning/planImport/types";

const RECIPE: PlanImportVerifiedRecipe = {
  key: "r1",
  title: "Lemon herb chicken",
  serves: 4,
  ingredients: ["chicken", "lemon", "herbs"],
  supprNutrition: { calories: 520, protein: 42, carbs: 12, fat: 28, fiberG: 4 },
  confidence: "high",
  confidenceTier: "high",
  ingredientCount: 8,
};

const meta = {
  title: "Mobile/Cookbook/CookbookReviewRow",
  component: CookbookReviewRow,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CookbookReviewRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Included: Story = {
  args: { item: RECIPE, excluded: false, nutritionMode: "suppr", onToggle: () => undefined },
};

export const Excluded: Story = {
  args: { item: RECIPE, excluded: true, nutritionMode: "author", onToggle: () => undefined },
};
