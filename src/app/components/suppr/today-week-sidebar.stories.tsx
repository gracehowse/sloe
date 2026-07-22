import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayWeekSidebar } from "./today-week-sidebar";

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
  title: "Suppr/TodayWeekSidebar",
  component: TodayWeekSidebar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    calorieTarget: 2000,
    activeDateKey: TODAY_KEY,
    todayDateKey: TODAY_KEY,
    onSelectDayKey: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 240, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayWeekSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedWeek: Story = {
  args: { byDay: buildByDay() },
};

export const SparseLogging: Story = {
  args: {
    byDay: {
      "2026-06-15": [],
      "2026-06-16": [{ calories: 1900 }],
      "2026-06-17": [],
      "2026-06-18": [],
      "2026-06-19": [{ calories: 2050 }],
      "2026-06-20": [],
      "2026-06-21": [],
    },
    activeDateKey: "2026-06-19",
  },
};
