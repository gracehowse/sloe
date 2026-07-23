import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AddIngredientDialog } from "./add-ingredient-dialog";

const meta = {
  title: "Suppr/AddIngredientDialog",
  component: AddIngredientDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Add an ingredient to an imported recipe — find-match preview or manual override.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onAdd: () => undefined,
    recipeId: "r_demo_123",
  },
} satisfies Meta<typeof AddIngredientDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutRecipeId: Story = {
  name: "Without recipe id",
  args: { recipeId: undefined },
};
