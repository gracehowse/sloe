import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { RemainingMacrosBar } from "./RemainingMacrosBar";

const TARGETS = { calories: 2100, protein: 140, carbs: 220, fat: 70, fiber: 30 };

const meta = {
  title: "Mobile/Components/RemainingMacrosBar",
  component: RemainingMacrosBar,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RemainingMacrosBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    targets: TARGETS,
    consumed: { calories: 980, protein: 62, carbs: 95, fat: 28, fiber: 12 },
  },
};

export const OverBudget: Story = {
  args: {
    targets: TARGETS,
    consumed: { calories: 2400, protein: 155, carbs: 260, fat: 85, fiber: 34 },
  },
};
