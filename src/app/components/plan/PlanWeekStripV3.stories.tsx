import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { computePlanDayStatus } from "@/lib/planning/planWeekStatus";
import { PlanWeekStripV3 } from "./PlanWeekStripV3";
import { noop, PlanMobileFrame, sampleWeek, weekDates } from "./_planStoryFixtures";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const stripDays = sampleWeek.map((dp, i) => ({
  key: String(i),
  dayLetter: DAY_LETTERS[weekDates[i]?.getDay() ?? 0] ?? "M",
  dateNum: weekDates[i]?.getDate() ?? 15 + i,
  status: computePlanDayStatus(
    dp.meals.map((m, j) => ({
      slot: ["Breakfast", "Lunch", "Dinner", "Snacks"][j] ?? "Snacks",
      kcal: m.calories,
      empty: m.isPlaceholder,
    })),
  ),
  isToday: i === 3,
}));

const meta = {
  title: "Plan/PlanWeekStripV3",
  component: PlanWeekStripV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    days: stripDays,
    selectedKey: "3",
    onSelectDay: noop,
  },
} satisfies Meta<typeof PlanWeekStripV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedWeek: Story = {};

export const TodaySelected: Story = {
  args: { selectedKey: "3" },
};

export const MondaySelected: Story = {
  args: { selectedKey: "0" },
};
