import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayDateHeader } from "./today-date-header";

const SELECTED_KEY = "2026-06-21";
const selectedDate = new Date("2026-06-21T12:00:00");

const loggedDays = new Set([
  "2026-06-15",
  "2026-06-16",
  "2026-06-18",
  "2026-06-19",
  "2026-06-21",
]);

const noop = () => undefined;

const baseArgs = {
  viewMode: "day" as const,
  onViewModeChange: noop,
  selectedDate,
  selectedDateKey: SELECTED_KEY,
  onSelectDateKey: noop,
  weekLabel: "16–22 Jun",
  weekStartDay: "monday" as const,
  loggedDays,
  protectedDateKeys: new Set<string>(),
  avatarLetter: "G",
  onNavigatePrev: noop,
  onNavigateNext: noop,
  onOpenCalendar: noop,
  onOpenSettings: noop,
  dayGreeting: "Good afternoon",
  streakDays: 4,
};

const meta = {
  title: "Suppr/TodayDateHeader",
  component: TodayDateHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 390, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: baseArgs,
} satisfies Meta<typeof TodayDateHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayView: Story = {};

export const WeekView: Story = {
  args: { viewMode: "week" },
};

export const StripOnly: Story = {
  args: { stripOnly: true, hideViewModeToggle: true },
};
