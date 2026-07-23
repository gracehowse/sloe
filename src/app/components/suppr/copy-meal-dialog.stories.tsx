import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CopyMealDialog } from "./copy-meal-dialog";

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

const meta = {
  title: "Suppr/CopyMealDialog",
  component: CopyMealDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Copy a meal (or slot) to another day — date chips, quick ranges, target slot picker.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
    slots: SLOTS,
    sourceSlot: "Lunch",
    sourceDayKey: "2026-07-21",
    mealLabel: "Miso salmon bowl",
  },
} satisfies Meta<typeof CopyMealDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMacros: Story = {
  name: "With branded macros",
  args: {
    mealMacros: {
      calories: 642,
      protein: 41,
      carbs: 58,
      fat: 22,
    },
  },
};
