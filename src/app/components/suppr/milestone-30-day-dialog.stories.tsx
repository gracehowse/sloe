import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Milestone30DayDialog } from "./milestone-30-day-dialog";
import type { Milestone30DayContent } from "../../../lib/nutrition/milestone30Day";

const SAMPLE_CONTENT: Milestone30DayContent = {
  headline: "30 days of showing up",
  daysLogged: 32,
  avgDailyKcal: 1985,
  longestStreak: 11,
  topFoods: [
    { name: "Greek yogurt", count: 18 },
    { name: "Oatmeal", count: 14 },
    { name: "Chicken breast", count: 12 },
  ],
  totalWeightDeltaKg: -2.4,
};

const meta = {
  title: "Suppr/Milestone30DayDialog",
  component: Milestone30DayDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "30-day logging milestone trust moment — stats snapshot, single Keep going CTA.",
      },
    },
  },
  args: {
    open: true,
    content: SAMPLE_CONTENT,
    onDismiss: () => undefined,
  },
} satisfies Meta<typeof Milestone30DayDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithWeightDelta: Story = {};

export const WithoutWeight: Story = {
  args: {
    content: {
      ...SAMPLE_CONTENT,
      totalWeightDeltaKg: null,
      topFoods: [{ name: "Banana", count: 9 }],
    },
  },
};
