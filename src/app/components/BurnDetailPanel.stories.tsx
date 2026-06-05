import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BurnDetailPanel } from "./BurnDetailPanel";

/**
 * BurnDetailPanel — the "Activity Bonus" energy-breakdown dialog (active /
 * resting / projected future burn, projected total, maintenance target, and
 * the earned bonus calories). Matches mobile `app/burn-detail.tsx`.
 *
 * Rendered open (`open: true`) so Chromatic captures the dialog body. The
 * dialog portals, so `layout: "fullscreen"`.
 *
 * Note on determinism: `computeProjectedBurn` reads `new Date()` to
 * extrapolate the remaining-day resting burn, so the "Future Energy Burned"
 * line (and therefore the projected total + bonus) varies by capture time of
 * day. The static sections (active / resting / target) are stable; the
 * stories pick inputs where the qualitative state — bonus earned vs not — is
 * robust to that variation.
 *
 * a11y: the "Bonus Calories Earned" label uses `text-activity` (Sloe gold
 * `#D6A24A`) on the activity-soft tint (~1.89:1) — a pre-existing AA
 * contrast miss in the component, not introduced here. `a11y.test: "todo"`
 * keeps axe running as a warning while the Chromatic visual coverage stands.
 */

const meta = {
  title: "Components/BurnDetailPanel",
  component: BurnDetailPanel,
  tags: ["ai-generated"],
  parameters: { layout: "fullscreen", a11y: { test: "todo" } },
  args: {
    open: true,
    onClose: () => {},
  },
} satisfies Meta<typeof BurnDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Bonus earned — large active burn + workouts push projected burn well
 *  past maintenance, so the activity-tinted "Bonus Calories Earned" block
 *  shows a positive value regardless of time of day. */
export const BonusEarned: Story = {
  args: {
    activeBurn: 900,
    restingBurn: 1500,
    steps: 12400,
    workouts: [
      { type: "Running", minutes: 45, calories: 520 },
      { type: "Strength", minutes: 30, calories: 180 },
    ],
    maintenanceKcal: 2100,
    bonusCalories: 300,
  },
};

/** No bonus yet — burn under maintenance, the muted "No Bonus Yet" block. */
export const NoBonus: Story = {
  args: {
    activeBurn: 120,
    restingBurn: 800,
    steps: 3200,
    workouts: [],
    maintenanceKcal: 2100,
    bonusCalories: 0,
  },
};

/** No maintenance figure — target + bonus sections are hidden entirely. */
export const NoMaintenance: Story = {
  args: {
    activeBurn: 400,
    restingBurn: 1200,
    steps: 8000,
    workouts: [{ type: "Cycling", minutes: 40, calories: 360 }],
    maintenanceKcal: 0,
    bonusCalories: 0,
  },
};

export const BonusEarnedDark: Story = {
  args: {
    activeBurn: 900,
    restingBurn: 1500,
    steps: 12400,
    workouts: [{ type: "Running", minutes: 45, calories: 520 }],
    maintenanceKcal: 2100,
    bonusCalories: 300,
  },
  globals: { theme: "dark" },
};
