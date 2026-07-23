import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayHeroRing } from "./today-hero-ring";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 390, background: "var(--bg)", padding: 16 }}>
      {children}
    </div>
  );
}

const baseArgs = {
  proteinPct: 0.35,
  carbsPct: 0.4,
  fatPct: 0.25,
  expanded: false,
  onToggleExpanded: () => undefined,
  onPressStatusChip: () => undefined,
};

const meta = {
  title: "Suppr/TodayHeroRing",
  component: TodayHeroRing,
  tags: ["autodocs"],
  render: (args) => (
    <Frame>
      <TodayHeroRing {...args} />
    </Frame>
  ),
  args: baseArgs,
} satisfies Meta<typeof TodayHeroRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreshDay: Story = {
  args: {
    consumed: 0,
    target: 2000,
    baseGoal: 2000,
    isFreshDay: true,
    onLogFreshDaySlot: () => undefined,
  },
};

export const UnderTarget: Story = {
  args: {
    consumed: 1240,
    target: 2000,
    baseGoal: 2000,
  },
};

export const OverTarget: Story = {
  args: {
    consumed: 2380,
    target: 2000,
    baseGoal: 2000,
  },
};
