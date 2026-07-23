import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OverrideIngredientDialog } from "./override-ingredient-dialog";

const meta = {
  title: "Suppr/OverrideIngredientDialog",
  component: OverrideIngredientDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Pin manual macros on an ingredient row when the matched source is wrong.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    ingredientName: "rolled oats",
    currentMacros: {
      calories: 150,
      protein: 5,
      carbs: 27,
      fat: 3,
      fiber: 4,
    },
    hasExistingOverride: false,
    onSave: () => undefined,
    onReset: () => undefined,
  },
} satisfies Meta<typeof OverrideIngredientDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewOverride: Story = {};

export const ExistingOverride: Story = {
  args: {
    hasExistingOverride: true,
    currentMacros: {
      calories: 165,
      protein: 6,
      carbs: 28,
      fat: 3.5,
      fiber: 4.5,
    },
  },
};
