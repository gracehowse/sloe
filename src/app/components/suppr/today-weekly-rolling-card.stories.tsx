import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayWeeklyRollingCard } from "./today-weekly-rolling-card";

const meta = {
  title: "Suppr/TodayWeeklyRollingCard",
  component: TodayWeeklyRollingCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayWeeklyRollingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deficit: Story = {
  args: {
    weekSummaryMode: "rolling",
    weekConsumed: 12840,
    isWeekDeficit: true,
    dailyAvgDeficit: 280,
    weekDeficit: 1960,
    weeklyMassLabel: "~0.25 kg",
  },
};

export const Surplus: Story = {
  args: {
    weekSummaryMode: "calendar_week",
    weekConsumed: 15400,
    isWeekDeficit: false,
    dailyAvgDeficit: 120,
    weekDeficit: 840,
    weeklyMassLabel: "~0.1 kg",
  },
};
