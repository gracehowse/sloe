import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ImportReviewFlaggedNote } from "./ImportReviewFlaggedNote";
import type { ImportQualityRecipe } from "@suppr/shared/recipes/importQualitySignal";

const flaggedRecipe: ImportQualityRecipe = {
  calories: 310,
  ingredientMacros: [
    { source: "USDA", calories: 120 },
    { source: "Estimated", calories: 0 },
    { source: "Unverified", calories: 0 },
  ],
};

const cleanRecipe: ImportQualityRecipe = {
  calories: 420,
  ingredientMacros: [
    { source: "USDA", calories: 120 },
    { source: "USDA", calories: 180 },
  ],
};

const meta = {
  title: "Mobile/Import/ImportReviewFlaggedNote",
  component: ImportReviewFlaggedNote,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ImportReviewFlaggedNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Flagged: Story = { args: { recipe: flaggedRecipe } };
export const CleanImportHidden: Story = { args: { recipe: cleanRecipe } };
