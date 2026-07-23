import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayDesktopRightRail } from "./today-desktop-right-rail";
import { TodayAppleHealthCard } from "./today-apple-health-card";

const TODAY_KEY = "2026-06-21";

function buildByDay(): Record<string, ReadonlyArray<{ calories: number }>> {
  const keys = [
    "2026-06-15",
    "2026-06-16",
    "2026-06-17",
    "2026-06-18",
    "2026-06-19",
    "2026-06-20",
    "2026-06-21",
  ];
  const totals = [0, 1820, 0, 2100, 1980, 2450, 1240];
  const byDay: Record<string, ReadonlyArray<{ calories: number }>> = {};
  keys.forEach((key, i) => {
    byDay[key] = totals[i] > 0 ? [{ calories: totals[i] }] : [];
  });
  return byDay;
}

const meta = {
  title: "Suppr/TodayDesktopRightRail",
  component: TodayDesktopRightRail,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    targetKcal: 2000,
    weekDailyKcal: [0, 1820, 0, 2100, 1980, 2450, 1240],
    weekDayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    weekLoggedDays: 5,
    weekAvgKcal: 1918,
    streakDays: 4,
    activeDateKey: TODAY_KEY,
    todayDateKey: TODAY_KEY,
    byDay: buildByDay(),
    onSelectDayKey: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayDesktopRightRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHealthExtra: Story = {
  args: {
    railExtra: (
      <TodayAppleHealthCard
        stepsForSelectedDay={8432}
        activeEnergyKcal={412}
        restingBurnKcal={1580}
        latestWeightKg={72.4}
      />
    ),
  },
};
