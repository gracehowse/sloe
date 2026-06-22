import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeeklyRecapDialog } from "./weekly-recap-dialog";

/**
 * WeeklyRecapDialog — the recap destination (ENG-1225 #20): the shareable card
 * plus Save / Share. Rendered open so the modal content (card + actions) is
 * visible.
 */
const meta = {
  title: "Suppr/WeeklyRecapDialog",
  component: WeeklyRecapDialog,
  tags: ["ai-generated"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WeeklyRecapDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    weekLabel: "16–22 Jun",
    onTargetDays: 5,
    dailyCalories: [1980, 2120, 1850, 2460, 1920, 2050, null],
    targetCalories: 2100,
    narrative: "A steady, consistent week.",
  },
};
