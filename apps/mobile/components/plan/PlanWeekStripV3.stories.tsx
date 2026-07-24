import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanWeekStripV3 } from "./PlanWeekStripV3";

const meta = {
  title: "Mobile/Plan/PlanWeekStripV3",
  component: PlanWeekStripV3,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The Plan week strip: 7 cells of day letter + date numeral + a 3-state status ring (full = sage / part = amber / empty = hollow outline), with navigation folded in. The 2026-07-24 pass removed the plum cell fill so Plan matches Today's DayStrip, and the status ring now keeps its real colour whether or not the day is selected — status is status, not a selection channel. Today (when not selected) tints its letter the brand accent. Web twin: src/app/components/plan/PlanWeekStripV3.tsx.",
      },
    },
  },
  args: {
    days: [
      { key: "d1", dayLetter: "M", dateNum: 16, status: "full", isToday: false },
      { key: "d2", dayLetter: "T", dateNum: 17, status: "part", isToday: false },
      { key: "d3", dayLetter: "W", dateNum: 18, status: "empty", isToday: true },
      { key: "d4", dayLetter: "T", dateNum: 19, status: "full", isToday: false },
      { key: "d5", dayLetter: "F", dateNum: 20, status: "part", isToday: false },
      { key: "d6", dayLetter: "S", dateNum: 21, status: "empty", isToday: false },
      { key: "d7", dayLetter: "S", dateNum: 22, status: "full", isToday: false },
    ],
    selectedKey: "d3",
    onSelectDay: () => undefined,
  },
} satisfies Meta<typeof PlanWeekStripV3>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A part-planned week — every ring state visible in one row. */
export const MixedStatuses: Story = {};

export const TodaySelected: Story = { args: { selectedKey: "d3" } };

/**
 * Selection on a day that is NOT today, so the two states can be told apart in
 * the snapshot: today keeps its accent letter while `selectedKey` moves.
 */
export const NonTodaySelected: Story = { args: { selectedKey: "d6" } };

/** A fully planned week — seven sage rings, the "nothing to fix" read. */
export const FullyPlannedWeek: Story = {
  args: {
    days: [
      { key: "d1", dayLetter: "M", dateNum: 16, status: "full", isToday: false },
      { key: "d2", dayLetter: "T", dateNum: 17, status: "full", isToday: false },
      { key: "d3", dayLetter: "W", dateNum: 18, status: "full", isToday: true },
      { key: "d4", dayLetter: "T", dateNum: 19, status: "full", isToday: false },
      { key: "d5", dayLetter: "F", dateNum: 20, status: "full", isToday: false },
      { key: "d6", dayLetter: "S", dateNum: 21, status: "full", isToday: false },
      { key: "d7", dayLetter: "S", dateNum: 22, status: "full", isToday: false },
    ],
  },
};

/** An empty week — seven hollow outlines, the state the empty-week card sits under. */
export const EmptyWeek: Story = {
  args: {
    days: [
      { key: "d1", dayLetter: "M", dateNum: 16, status: "empty", isToday: false },
      { key: "d2", dayLetter: "T", dateNum: 17, status: "empty", isToday: false },
      { key: "d3", dayLetter: "W", dateNum: 18, status: "empty", isToday: true },
      { key: "d4", dayLetter: "T", dateNum: 19, status: "empty", isToday: false },
      { key: "d5", dayLetter: "F", dateNum: 20, status: "empty", isToday: false },
      { key: "d6", dayLetter: "S", dateNum: 21, status: "empty", isToday: false },
      { key: "d7", dayLetter: "S", dateNum: 22, status: "empty", isToday: false },
    ],
  },
};
