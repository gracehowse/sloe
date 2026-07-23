import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressTrajectoryHero } from "./ProgressTrajectoryHero";
import type { WeightTrendResult } from "@/lib/progress/weightTrend";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/Hierarchy/ProgressTrajectoryHero",
  component: ProgressTrajectoryHero,
  tags: ["autodocs"],
  decorators: [(Story) => (<MobileStoryThemeProvider><div style={{ width: 360, padding: 16, background: "#F7F6FA" }}><Story /></div></MobileStoryThemeProvider>)],
  parameters: { layout: "fullscreen" },
  args: {
    mode: "trends_only" as const,
    latestWeightKg: 72.4,
    goalWeightKg: 68,
    weightKgByDay: { "2026-07-15": 72.4 },
    measurementSystem: "metric" as const,
    trend: { points: [{ dateISO: "2026-07-15", kg: 72.4 }], movingAvg: [72.4], yDomain: [72, 73], trendCopy: "Down 0.4 kg", trendDirection: "improving", trendDeltaKg: -0.4, trendStatus: "down", sinceLabel: "Last 30 days", periodRangeLabel: "15 Jun – 15 Jul", daysSinceLatest: 1, bucket: "daily" } satisfies WeightTrendResult,
    range: "1m" as const,
    chartKey: "W:0",
    byDay: { "2026-07-01": [{ calories: 1500 }] },
    targetCalories: 1500,
    maintenanceTdeeKcal: 2200,
    userGoal: "lose",
    timeline: null,
    weekDeltaKg: -0.4,
    periodWindowLabel: "This month",
    onLogWeight: () => undefined,
  },
} satisfies Meta<typeof ProgressTrajectoryHero>;

export default meta;
type Story = StoryObj<typeof meta>;
export const TrendsOnly = {} as Story;
export const Hidden: Story = { args: { mode: "hide" as const } };