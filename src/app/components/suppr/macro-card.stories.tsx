import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MacroCard } from "./macro-card";

/**
 * MacroCard — colour-coded macro tile (protein / carbs / fat / calories)
 * with an optional target progress bar. Used on Today, recipe detail, and
 * meal-plan views. Pure presentation — plain-number props, no providers.
 *
 * Stories cover all four macro types, the `compact` inline variant, and the
 * no-target (no progress bar) case so Chromatic pins each colour token + the
 * bar/label layout.
 */

const meta = {
  title: "Suppr/MacroCard",
  component: MacroCard,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[160px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MacroCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Protein: Story = {
  args: { macro: "protein", value: 84, target: 150 },
};

export const Carbs: Story = {
  args: { macro: "carbs", value: 180, target: 220 },
};

export const Fat: Story = {
  args: { macro: "fat", value: 42, target: 70 },
};

export const Calories: Story = {
  args: { macro: "calories", value: 1450, target: 2000 },
};

/** No target → no progress bar / "of X" line, just the value. */
export const NoTarget: Story = {
  args: { macro: "protein", value: 84 },
};

/** At/over target — the bar caps at 100% width. */
export const Full: Story = {
  args: { macro: "protein", value: 165, target: 150 },
};

/** Compact inline variant — icon + value + unit on one row. */
export const Compact: Story = {
  args: { macro: "protein", value: 84, compact: true },
  decorators: [
    (Story) => (
      <div className="rounded-card bg-card p-3">
        <Story />
      </div>
    ),
  ],
};

/** All four tiles in a row — the canonical Today macro strip. */
export const Row: Story = {
  // `render` ignores args, but the required `macro`/`value` props must be
  // satisfied for the strict `StoryObj<typeof meta>` type.
  args: { macro: "protein", value: 84 },
  render: () => (
    <div className="flex gap-2">
      <MacroCard macro="protein" value={84} target={150} />
      <MacroCard macro="carbs" value={180} target={220} />
      <MacroCard macro="fat" value={42} target={70} />
    </div>
  ),
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
};

export const ProteinDark: Story = {
  args: { macro: "protein", value: 84, target: 150 },
  globals: { theme: "dark" },
};
