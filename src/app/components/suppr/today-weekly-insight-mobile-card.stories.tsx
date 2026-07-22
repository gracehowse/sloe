import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayWeeklyInsightMobileCard } from "./today-weekly-insight-mobile-card";

function withInsightFlag(Story: React.ComponentType) {
  if (typeof window !== "undefined") {
    const w = window as Window & { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
    w.__SUPPR_FORCE_FLAGS__ = {
      ...w.__SUPPR_FORCE_FLAGS__,
      "today-weekly-insight-mobile": true,
    };
  }
  return <Story />;
}

const meta = {
  title: "Suppr/TodayWeeklyInsightMobileCard",
  component: TodayWeeklyInsightMobileCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    withInsightFlag,
    (Story) => (
      <div style={{ width: 390, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    householdSize: 1,
    dailyKcalTarget: 2000,
    weekDailyKcal: [1980, 0, 2120, 1850, 2050, 0, 1240],
  },
} satisfies Meta<typeof TodayWeeklyInsightMobileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidWeek: Story = {
  args: {
    loggedDaysInWeek: 5,
    weekAvgKcal: 1848,
  },
};

export const EmptyWeek: Story = {
  args: {
    loggedDaysInWeek: 0,
    weekAvgKcal: null,
    weekDailyKcal: [0, 0, 0, 0, 0, 0, 0],
  },
};
