import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressTrajectoryHero } from "./progress-trajectory-hero";
import { hierarchyTimeline } from "./_storyFixtures";

const meta = {
  title: "Suppr/ProgressHierarchy/ProgressTrajectoryHero",
  component: ProgressTrajectoryHero,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "§1 Trajectory hero — tinted weight card (show) or trend-only plain card (trends_only).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressTrajectoryHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TowardGoal: Story = {
  name: "Toward goal (show)",
  args: {
    surfaceMode: "show",
    isImperial: false,
    latestWeightKg: 72.4,
    goalWeightKg: 68,
    timeline: hierarchyTimeline,
    weighInDayCount: 20,
    chartData: [
      { date: "1 Jul", value: 73.1, ma: 73.0 },
      { date: "8 Jul", value: 72.7, ma: 72.8 },
      { date: "15 Jul", value: 72.4, ma: 72.6, isToday: true },
    ],
    goalWeightChart: 68,
    showRawDots: true,
    byDay: {
      "2026-07-01": [{ calories: 1500 }],
      "2026-07-02": [{ calories: 1600 }],
      "2026-07-03": [{ calories: 1550 }],
      "2026-07-04": [{ calories: 1480 }],
      "2026-07-05": [{ calories: 1520 }],
    },
    targetCalories: 1500,
    maintenanceTdeeKcal: 2200,
    goal: "lose",
    weekDeltaKg: -0.4,
    windowLabel: "This month",
    sparse: false,
    onLogWeight: () => undefined,
  },
};

export const TrendOnly: Story = {
  name: "Trend only (no kg)",
  args: {
    surfaceMode: "trends_only",
    isImperial: false,
    latestWeightKg: 72.4,
    goalWeightKg: 68,
    timeline: hierarchyTimeline,
    weighInDayCount: 20,
    chartData: [],
    goalWeightChart: null,
    showRawDots: false,
    byDay: {},
    targetCalories: 1500,
    weekDeltaKg: -0.4,
    windowLabel: "This month",
    sparse: false,
    onLogWeight: () => undefined,
  },
};

export const SparseHero: Story = {
  name: "Sparse (<2 weigh-ins)",
  args: {
    surfaceMode: "show",
    isImperial: false,
    latestWeightKg: null,
    goalWeightKg: 68,
    timeline: null,
    weighInDayCount: 0,
    chartData: [{ date: "15 Jul", value: 72.4 }],
    goalWeightChart: 68,
    showRawDots: true,
    byDay: {},
    targetCalories: 1500,
    weekDeltaKg: null,
    windowLabel: "This month",
    sparse: true,
    onLogWeight: () => undefined,
  },
};
