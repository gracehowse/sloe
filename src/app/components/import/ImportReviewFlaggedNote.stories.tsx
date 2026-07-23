import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ImportReviewFlaggedNote } from "./ImportReviewFlaggedNote";
import type { ImportQualityRecipe } from "@/lib/recipes/importQualitySignal";

const cleanRecipe: ImportQualityRecipe = {
  calories: 420,
  ingredientMacros: [
    { source: "USDA", calories: 120 },
    { source: "USDA", calories: 180 },
  ],
};

const flaggedRecipe: ImportQualityRecipe = {
  calories: 310,
  ingredientMacros: [
    { source: "USDA", calories: 120 },
    { source: "Estimated", calories: 0 },
    { source: "Unverified", calories: 0 },
  ],
};

const meta = {
  title: "Suppr/Import/ImportReviewFlaggedNote",
  component: ImportReviewFlaggedNote,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    recipe: flaggedRecipe,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImportReviewFlaggedNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FlaggedImport: Story = {};

export const CleanImportHidden: Story = {
  args: { recipe: cleanRecipe },
  parameters: {
    docs: {
      description: {
        story: "Renders nothing when no ingredients need review.",
      },
    },
  },
};
