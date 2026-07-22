import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayDashboardMacroBars } from "./today-dashboard-macro-bars";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 360, background: "var(--bg)", padding: 16 }}>
      {children}
    </div>
  );
}

const baseArgs = {
  trackedMacros: ["protein", "carbs", "fat", "fiber", "sugar", "sodium", "water"],
  proteinCurrent: 62,
  proteinTarget: 130,
  carbsCurrent: 88,
  carbsTarget: 195,
  fatCurrent: 41,
  fatTarget: 62,
  fiberCurrent: 12,
  fiberTarget: 41,
  sugarG: 18,
  sodiumMg: 920,
  waterCurrentMl: 1200,
  waterTargetMl: 2000,
  onPressMacro: () => undefined,
};

const meta = {
  title: "Suppr/TodayDashboardMacroBars",
  component: TodayDashboardMacroBars,
  tags: ["autodocs"],
  render: (args) => (
    <Frame>
      <TodayDashboardMacroBars {...args} />
    </Frame>
  ),
  args: baseArgs,
} satisfies Meta<typeof TodayDashboardMacroBars>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const NetCarbsLens: Story = {
  args: {
    ...baseArgs,
    netCarbsLensEnabled: true,
    carbsCurrent: 76,
    fiberCurrent: 12,
  },
};
