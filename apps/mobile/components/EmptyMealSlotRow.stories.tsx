import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { EmptyMealSlotAimLine } from "./EmptyMealSlotRow";

const meta = {
  title: "Mobile/Components/EmptyMealSlotAimLine",
  component: EmptyMealSlotAimLine,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EmptyMealSlotAimLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TodaySurface: Story = {
  args: { slot: "breakfast", aimKcal: 420, surface: "today", variant: "today" },
};

export const PlanSurface: Story = {
  args: { slot: "dinner", aimKcal: 650, surface: "plan", variant: "plan" },
};
