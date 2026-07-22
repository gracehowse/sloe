import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SharedMealAcceptDialog } from "./shared-meal-accept-dialog";
import type { MealSharePayload } from "../../../lib/share/mealShareLink";

const PAYLOAD: MealSharePayload = {
  title: "Lunch on the go",
  mealSlot: "Lunch",
  sharedBy: "Grace",
  createdAt: "2026-07-22T09:00:00.000Z",
  items: [
    {
      recipeTitle: "Chicken salad",
      calories: 420,
      protein: 38,
      carbs: 20,
      fat: 18,
    },
    {
      recipeTitle: "Greek yogurt",
      calories: 140,
      protein: 15,
      carbs: 10,
      fat: 4,
      fiberG: 0,
    },
  ],
};

const meta = {
  title: "Suppr/SharedMealAcceptDialog",
  component: SharedMealAcceptDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Recipient confirm sheet for a resolved meal-share payload — pick day + slot, then log.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
    payload: PAYLOAD,
  },
} satisfies Meta<typeof SharedMealAcceptDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleItem: Story = {
  name: "Single item",
  args: {
    payload: {
      ...PAYLOAD,
      title: "Post-run snack",
      mealSlot: "Snacks",
      sharedBy: null,
      items: [PAYLOAD.items[0]!],
    },
  },
};
