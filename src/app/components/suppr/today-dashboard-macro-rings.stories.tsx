import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayDashboardMacroRings } from "./today-dashboard-macro-rings";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 360, background: "var(--bg)", padding: 16 }}>
      {children}
    </div>
  );
}

const baseArgs = {
  proteinCurrent: 62,
  proteinTarget: 130,
  carbsCurrent: 88,
  carbsTarget: 195,
  fatCurrent: 41,
  fatTarget: 62,
  fiberCurrent: 12,
  fiberTarget: 41,
  onPressMacro: () => undefined,
};

const meta = {
  title: "Suppr/TodayDashboardMacroRings",
  component: TodayDashboardMacroRings,
  tags: ["autodocs"],
  render: (args) => (
    <Frame>
      <TodayDashboardMacroRings {...args} />
    </Frame>
  ),
  args: baseArgs,
} satisfies Meta<typeof TodayDashboardMacroRings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const EarlyDay: Story = {
  args: {
    proteinCurrent: 8,
    carbsCurrent: 12,
    fatCurrent: 5,
    fiberCurrent: 0,
  },
};
