import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressHeroMetric } from "./progress-hero-metric";

/**
 * ProgressHeroMetric — Oura-style "one big thing" at the top of Progress
 * (ENG-616): adherence ring + score + on-target dots. Mirror:
 * `apps/mobile/components/progress/ProgressHeroMetric.tsx`. Pins the
 * adherence-tone branches so Chromatic guards the ring colour mapping as a
 * durable regression layer:
 *
 *   - On target (90–110%) → sage ring + green number, "up N%" trend chip.
 *   - Under target (< 90%) → sage ring, calm "Under target" label.
 *   - Over target (> 110%) → destructive-red ring + overshoot reading.
 *   - Empty (no days logged) → "Your score builds over time" placeholder.
 */
const meta = {
  title: "Suppr/ProgressHeroMetric",
  component: ProgressHeroMetric,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    adherencePct: 98,
    avgCaloriesPerDay: 1960,
    targetCalories: 2000,
    daysLogged: 6,
    streak: 12,
    onTargetDays: [true, true, false, true, true, true, false],
    adherenceDeltaPct: 4,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 380, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressHeroMetric>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTarget: Story = {
  name: "On target (sage ring)",
  args: {
    adherencePct: 98,
    avgCaloriesPerDay: 1960,
    targetCalories: 2000,
    daysLogged: 6,
    streak: 12,
    onTargetDays: [true, true, false, true, true, true, false],
    adherenceDeltaPct: 4,
  },
};

export const UnderTarget: Story = {
  name: "Under target",
  args: {
    adherencePct: 82,
    avgCaloriesPerDay: 1640,
    targetCalories: 2000,
    daysLogged: 5,
    streak: 8,
    onTargetDays: [true, false, false, true, true, false, false],
    adherenceDeltaPct: -3,
  },
};

export const OverTarget: Story = {
  name: "Over target (red ring)",
  args: {
    adherencePct: 122,
    avgCaloriesPerDay: 2440,
    targetCalories: 2000,
    daysLogged: 6,
    streak: 3,
    onTargetDays: [false, true, false, false, true, false, false],
    adherenceDeltaPct: null,
  },
};

export const Empty: Story = {
  name: "Empty (no days logged)",
  args: {
    adherencePct: null,
    avgCaloriesPerDay: null,
    targetCalories: 2000,
    daysLogged: 0,
    streak: 0,
  },
};
