import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ImportSuccessSheet } from "./import-success-sheet";

const meta = {
  title: "Suppr/ImportSuccessSheet",
  component: ImportSuccessSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Import success magic moment — saved confirmation with optional macro and credit lines.",
      },
    },
  },
  args: {
    recipeTitle: "Crispy tofu rice bowl",
    recipeId: "r_demo_tofu_bowl",
    onViewRecipe: () => undefined,
  },
} satisfies Meta<typeof ImportSuccessSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    macroLine: "~520 kcal · 28g protein",
    creditLine: "Imported from TikTok",
    onReviewIngredients: () => undefined,
  },
};

export const Minimal: Story = {
  args: {
    macroLine: null,
    creditLine: null,
  },
};
