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
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The Plan week strip: 7 cells of day letter + date numeral + a 3-state status ring (full = sage / part = amber / empty = hollow outline), with navigation folded in. The 2026-07-24 pass removed the plum cell fill so Plan matches Today's DayStrip, and the status ring now keeps its real colour whether or not the day is selected — status is status, not a selection channel. Today (when not selected) tints its letter the brand accent. Mobile twin: apps/mobile/components/plan/PlanWeekStripV3.tsx.",
      },
    },
  },
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

/** A fully planned week — seven sage rings, the "nothing to fix" read. */
export const FullyPlannedWeek: Story = {
  args: {
    days: stripDays.map((d) => ({ ...d, status: "full" as const })),
  },
};

/** An empty week — seven hollow outlines, the state the empty-week card sits under. */
export const EmptyWeek: Story = {
  args: {
    days: stripDays.map((d) => ({ ...d, status: "empty" as const })),
  },
};
