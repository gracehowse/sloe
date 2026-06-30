import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BurnDetailPanel } from "./BurnDetailPanel";

/**
 * BurnDetailPanel — surplus-only calorie-burn breakdown dialog (mirrors
 * `apps/mobile/app/burn-detail.tsx`). Always rendered `open` here so the
 * dialog content is on-screen for pixel + a11y review. Pins the states:
 *
 *   - No bonus    → projected burn under maintenance → "No Bonus Yet" / 0.
 *   - Bonus earned → projected burn over maintenance → "+N" activity-solid
 *                    bonus chip.
 *   - With workouts → per-workout rows + steps line under Active Energy.
 *   - No maintenance → maintenance unknown (0) → Target + Bonus sections
 *                      collapse away; only the burn breakdown remains.
 *
 * `Future Energy Burned` extrapolates from the wall clock
 * (`computeProjectedBurn`), so its line is non-deterministic by design — the
 * stories pin the deterministic surfaces (active / resting / maintenance /
 * bonus branch). The a11y run scans the rendered dialog regardless.
 */
const meta = {
  title: "Suppr/BurnDetailPanel",
  component: BurnDetailPanel,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    open: true,
    onClose: () => {},
    activeBurn: 540,
    restingBurn: 1620,
    steps: 8400,
    workouts: [],
    maintenanceKcal: 2240,
    bonusCalories: 0,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BurnDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoBonus: Story = {
  name: "No bonus yet",
  args: {
    activeBurn: 320,
    restingBurn: 1480,
    steps: 5200,
    maintenanceKcal: 2240,
    bonusCalories: 0,
  },
};

export const BonusEarned: Story = {
  name: "Bonus earned (activity-solid)",
  args: {
    activeBurn: 760,
    restingBurn: 1620,
    steps: 11200,
    maintenanceKcal: 2240,
    bonusCalories: 180,
  },
};

export const WithWorkouts: Story = {
  name: "With workouts",
  args: {
    activeBurn: 980,
    restingBurn: 1640,
    steps: 9600,
    maintenanceKcal: 2300,
    bonusCalories: 240,
    workouts: [
      { type: "Running", minutes: 42, calories: 480 },
      { type: "Strength", minutes: 35, calories: 260 },
    ],
  },
};

export const NoMaintenance: Story = {
  name: "No maintenance (breakdown only)",
  args: {
    activeBurn: 540,
    restingBurn: 1600,
    steps: 7400,
    maintenanceKcal: 0,
    bonusCalories: 0,
  },
};
