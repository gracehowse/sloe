import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanMealActionDialog } from "./PlanMealActionDialog";
import { meal, noop } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanMealActionDialog",
  component: PlanMealActionDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Per-meal actions for a planned slot (log, swap, move, remove).",
      },
    },
  },
  args: {
    open: true,
    meal: meal("Lunch", 540),
    onClose: noop,
    onLogToday: noop,
    onViewRecipe: noop,
    onSwap: noop,
    onChangePortion: noop,
    onMove: noop,
    onRemove: noop,
    lockEnabled: true,
    onToggleLock: noop,
    isLocked: false,
  },
} satisfies Meta<typeof PlanMealActionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnlockedMeal: Story = {};

export const LockedMeal: Story = {
  args: { isLocked: true },
};
