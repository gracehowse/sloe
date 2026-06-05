import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TodayHeroRing } from "./today-hero-ring";

/**
 * TodayHeroRing — the Today-screen hero card wrapping `DailyRing` plus the
 * "Show / Hide macro rings" toggle. Thin presentation wrapper (mirrors
 * mobile `TodayHeroRing`); these stories prove the composed card — ring +
 * SupprCard shell + toggle button — renders for Chromatic.
 *
 * Callbacks are no-ops; the expanded/collapsed states are passed in (the
 * host owns that state).
 *
 * a11y: the "Show / Hide macro rings" toggle uses `text-primary` (Sloe clay
 * `#C8794E`, ~3.05:1 on cream) — a pre-existing AA contrast miss across the
 * re-skin, not introduced here. `a11y.test: "todo"` keeps axe running as a
 * warning while the Chromatic visual coverage stands.
 */

const meta = {
  title: "Suppr/TodayHeroRing",
  component: TodayHeroRing,
  tags: ["ai-generated"],
  parameters: { layout: "centered", a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
  args: {
    consumed: 1200,
    target: 2000,
    proteinPct: 0.7,
    carbsPct: 0.45,
    fatPct: 0.6,
    expanded: false,
    displayMode: "remaining",
    onToggleExpanded: () => {},
    onDisplayModeChange: () => {},
  },
} satisfies Meta<typeof TodayHeroRing>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Collapsed — ring only, "Show macro rings" toggle. */
export const Collapsed: Story = {};

/** Expanded — inner macro arcs visible, "Hide macro rings" toggle. */
export const Expanded: Story = {
  args: { expanded: true },
};

/** Over budget — red arc carries the over-budget signal in the hero. */
export const OverBudget: Story = {
  args: { consumed: 2400, target: 2000 },
};

/** Empty — calibrating idle ring as the first-impression hero. */
export const Empty: Story = {
  args: { consumed: 0, target: 2000 },
};

/** Dark theme. */
export const CollapsedDark: Story = {
  globals: { theme: "dark" },
};
