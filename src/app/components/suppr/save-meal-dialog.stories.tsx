import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SaveMealDialog } from "./save-meal-dialog";

const SAMPLE_ITEMS = [
  {
    recipeTitle: "Rolled oats",
    calories: 150,
    protein: 5,
    carbs: 27,
    fat: 3,
  },
  {
    recipeTitle: "Blueberries",
    calories: 40,
    protein: 0.5,
    carbs: 10,
    fat: 0.2,
  },
  {
    recipeTitle: "Whey protein",
    calories: 120,
    protein: 24,
    carbs: 2,
    fat: 1,
  },
];

const meta = {
  title: "Suppr/SaveMealDialog",
  component: SaveMealDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Create a reusable saved meal (usual) from logged items — name, slot, reorder.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onSave: () => undefined,
    initialItems: SAMPLE_ITEMS,
    defaultSlot: "Breakfast",
    suggestedName: "My usual breakfast",
  },
} satisfies Meta<typeof SaveMealDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TwoItems: Story = {
  args: {
    initialItems: SAMPLE_ITEMS.slice(0, 2),
    suggestedName: "",
  },
};
