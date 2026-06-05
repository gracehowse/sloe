import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DailyRing } from "./daily-ring";

/**
 * DailyRing — the Today-screen calorie progress ring (the "calorie ring").
 *
 * SVG-based with CSS-variable colours, so it auto-adapts to light / dark.
 * The colour ladder is the canonical 3-state mapping (see
 * `feedback_calorie_ring_colour_mapping`): EMPTY → calm brand "calibrating"
 * gradient, logged-and-under → green arc, logged-and-over → destructive red
 * + hashed overage segment. These stories pin one story per state plus the
 * expanded macro-ring view so Chromatic catches a regression in any of them.
 *
 * Pure presentation — every prop is a plain number, no providers needed.
 * The count-up animation snaps under `prefers-reduced-motion`; Chromatic's
 * capture is post-settle so the rendered number is the final value.
 */

const meta = {
  title: "Suppr/DailyRing",
  component: DailyRing,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: {
    size: 160,
    strokeWidth: 10,
  },
} satisfies Meta<typeof DailyRing>;

export default meta;
type Story = StoryObj<typeof meta>;

/** EMPTY — nothing logged yet. Centre shows the "Start your day"
 *  invitation over the calm brand "calibrating" idle gradient (not a flat
 *  grey track), per audit papercut #2 + ENG-826. */
export const Empty: Story = {
  args: { consumed: 0, target: 2000 },
};

/** UNDER budget — logged and comfortably under target. Green arc, centre
 *  shows remaining kcal. This is the everyday happy path. */
export const UnderBudget: Story = {
  args: { consumed: 1200, target: 2000 },
};

/** AT / near target — arc almost full, still green (a target-hit is the
 *  at/under-budget state). */
export const AtTarget: Story = {
  args: { consumed: 1950, target: 2000 },
};

/** OVER budget — destructive red arc + the diagonal-hash overage segment;
 *  centre flips to the OVER label and shows the amount over (B6: shows the
 *  positive "over by" integer, never a misleading "0"). */
export const OverBudget: Story = {
  args: { consumed: 2400, target: 2000 },
};

/** CONSUMED display mode — centre reads the running total ("LOGGED")
 *  instead of remaining. */
export const ConsumedMode: Story = {
  args: { consumed: 1200, target: 2000, displayMode: "consumed" },
};

/** EXPANDED — the three inner macro arcs (protein / carbs / fat) render at
 *  their own colours. Mirrors the mobile CalorieRing expanded state. */
export const ExpandedMacros: Story = {
  args: {
    consumed: 1200,
    target: 2000,
    expanded: true,
    proteinPct: 0.7,
    carbsPct: 0.45,
    fatPct: 0.6,
  },
};

/** No profile target yet (`target <= 0`) — treated as EMPTY/calibrating on
 *  both platforms (2026-05-05 R03 cross-platform fix), so it shows the calm
 *  idle gradient rather than over-budget amber. */
export const NoTarget: Story = {
  args: { consumed: 0, target: 0 },
};

/** Dark theme — confirms the CSS-variable arc colours + centre ink survive
 *  the dark surface. */
export const UnderBudgetDark: Story = {
  args: { consumed: 1200, target: 2000 },
  globals: { theme: "dark" },
};
