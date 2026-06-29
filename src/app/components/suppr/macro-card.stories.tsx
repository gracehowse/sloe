import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { MacroCard } from "./macro-card";

/**
 * MacroCard — colour-coded macro nutrient display. Pins the variants so
 * Chromatic guards them as a durable regression layer:
 *
 *   - Full card with target → value + progress bar + "of N" line.
 *   - Full card without target → value only, no bar.
 *   - Over-target → bar clamps at 100% (never overflows the track).
 *   - Compact → inline icon + value + unit (no card shell / bar).
 *
 * Each macro tone (protein / carbs / fat / calories) drives its own
 * `--macro-*` colour token, so the four-up grid pins the colour mapping too.
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 280, background: "var(--bg)", padding: 16 }}>
      {children}
    </div>
  );
}

const meta = {
  title: "Suppr/MacroCard",
  component: MacroCard,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: { macro: "protein", value: 88, target: 130 },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof MacroCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTarget: Story = {
  name: "Full (with target)",
  args: { macro: "protein", value: 88, target: 130 },
};

export const NoTarget: Story = {
  name: "Full (no target)",
  args: { macro: "carbs", value: 142, target: undefined },
};

export const OverTarget: Story = {
  name: "Over target (bar clamps)",
  args: { macro: "fat", value: 95, target: 62 },
};

export const Calories: Story = {
  name: "Calories (kcal unit)",
  args: { macro: "calories", value: 1840, target: 2000, unit: "kcal" },
};

export const Compact: Story = {
  name: "Compact (inline)",
  args: { macro: "protein", value: 88, compact: true },
};

/** All four macro tones side-by-side — pins the colour mapping. */
export const AllMacros: Story = {
  name: "All macros",
  render: () => (
    <div style={{ display: "flex", gap: 8, background: "var(--bg)", padding: 16 }}>
      <MacroCard macro="protein" value={88} target={130} />
      <MacroCard macro="carbs" value={142} target={195} />
      <MacroCard macro="fat" value={48} target={62} />
      <MacroCard macro="calories" value={1840} target={2000} unit="kcal" />
    </div>
  ),
};
