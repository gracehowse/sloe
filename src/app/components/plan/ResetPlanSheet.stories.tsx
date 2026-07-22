import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ResetPlanSheet } from "./ResetPlanSheet";
import { noop } from "./_planStoryFixtures";

const meta = {
  title: "Plan/ResetPlanSheet",
  component: ResetPlanSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Keep vs clear before regenerating the week plan.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: noop,
    onConfirm: noop,
  },
} satisfies Meta<typeof ResetPlanSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KeepLockedMeals: Story = {};

export const Regenerating: Story = {
  args: { loading: true },
};
