import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { BatchCookRecipeCandidate } from "@/lib/planning/batchCook";
import { BatchCookSheet } from "./BatchCookSheet";
import { noop } from "./_planStoryFixtures";

const RECIPES: BatchCookRecipeCandidate[] = [
  {
    id: "r1",
    title: "Harissa chickpea stew",
    calories: 860,
    protein: 38,
    timeMin: 35,
    servings: 2,
  },
  {
    id: "r2",
    title: "Slow lamb shoulder",
    calories: 1640,
    protein: 104,
    timeMin: 200,
    servings: 4,
  },
];

const meta = {
  title: "Plan/BatchCookSheet",
  component: BatchCookSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Pick a batch-friendly recipe and scale portions for the week.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: noop,
    recipes: RECIPES,
    onSave: noop,
    onCook: noop,
  },
} satisfies Meta<typeof BatchCookSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecipePicker: Story = {};

export const EmptyLibrary: Story = {
  args: { recipes: [] },
};

export const SavingPlan: Story = {
  args: { saving: true },
};
