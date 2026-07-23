import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AdjustConstraintsSheet } from "./AdjustConstraintsSheet";
import { noop } from "./_planStoryFixtures";

const meta = {
  title: "Plan/AdjustConstraintsSheet",
  component: AdjustConstraintsSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Calorie floor, meals-per-day, source, and batch-leftovers constraints.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: noop,
    initial: {
      source: "library",
      calorieFloor: 1600,
      mealsPerDay: 3,
      allowBatchLeftovers: true,
    },
    libraryCount: 42,
    discoverCount: 128,
    onSave: noop,
  },
} satisfies Meta<typeof AdjustConstraintsSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LibrarySource: Story = {};

export const DiscoverSourceFourMeals: Story = {
  args: {
    initial: {
      source: "discovery",
      calorieFloor: 1800,
      mealsPerDay: 4,
      allowBatchLeftovers: false,
    },
  },
};
