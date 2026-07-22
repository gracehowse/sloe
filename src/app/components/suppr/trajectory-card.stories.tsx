import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrajectoryCard } from "./trajectory-card";

function buildByDay(dayCount: number, calories = 1850) {
  const byDay: Record<string, Array<{ calories: number }>> = {};
  for (let i = 0; i < dayCount; i += 1) {
    const d = 15 + i;
    byDay[`2026-06-${String(d).padStart(2, "0")}`] = [{ calories }];
  }
  return byDay;
}

const meta = {
  title: "Suppr/TrajectoryCard",
  component: TrajectoryCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    latestWeightKg: 72.4,
    targetCalories: 2000,
    maintenanceTdeeKcal: 2350,
    goal: "lose",
    goalWeightKg: 68,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrajectoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {
  name: "Placeholder (<5 logged days)",
  args: {
    byDay: buildByDay(3),
  },
};

export const Projection: Story = {
  args: {
    byDay: buildByDay(6, 1820),
  },
};
