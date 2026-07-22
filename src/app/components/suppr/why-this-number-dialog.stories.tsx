import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WhyThisNumberDialog } from "./why-this-number-dialog";

const meta = {
  title: "Suppr/WhyThisNumberDialog",
  component: WhyThisNumberDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => undefined,
    targetCalories: 2000,
    maintenanceTdee: 2350,
    confidence: "medium",
    source: "adaptive",
    loggingDays: 21,
    goal: "lose",
    paceKgPerWeek: -0.5,
  },
} satisfies Meta<typeof WhyThisNumberDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AdaptiveTarget: Story = {};

export const Calibrating: Story = {
  args: {
    maintenanceTdee: null,
    confidence: null,
    source: null,
    loggingDays: 4,
    goal: null,
    paceKgPerWeek: null,
  },
};
