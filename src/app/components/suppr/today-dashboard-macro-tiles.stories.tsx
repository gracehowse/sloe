import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayDashboardMacroTiles } from "./today-dashboard-macro-tiles";

/**
 * TodayDashboardMacroTiles (the `tiles` macro variant) — pins the Sloe v3
 * `.mtile` hairline-grid conform (Grace 2026-06-25, ENG-1247): a 2-col grid
 * divided by hairlines (no card fill), each cell = colored icon on the LEFT +
 * value/goal + label + a full-width colored progress bar. Mirrors mobile
 * MacroStatTile. Chromatic guards it as a regression layer.
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 360, background: "var(--bg)", padding: 16 }}>
      {children}
    </div>
  );
}

const baseArgs = {
  trackedMacros: ["protein", "carbs", "fat", "fiber"],
  proteinCurrent: 13,
  proteinTarget: 130,
  carbsCurrent: 1,
  carbsTarget: 195,
  fatCurrent: 10,
  fatTarget: 62,
  fiberCurrent: 0,
  fiberTarget: 41,
  sugarG: 0,
  sodiumMg: 0,
  waterCurrentMl: 0,
  waterTargetMl: 2000,
  formatWaterLine: (ml: number) => `${ml} ml`,
  onAddWaterMl: () => {},
  onPressMacro: () => {},
};

const meta: Meta<typeof TodayDashboardMacroTiles> = {
  title: "Suppr/TodayDashboardMacroTiles",
  component: TodayDashboardMacroTiles,
  render: (args) => (
    <Frame>
      <TodayDashboardMacroTiles {...args} />
    </Frame>
  ),
  args: baseArgs,
};
export default meta;

type Story = StoryObj<typeof TodayDashboardMacroTiles>;

export const HairlineGrid: Story = {};
