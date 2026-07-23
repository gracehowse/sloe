import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayMacroSection } from "./today-macro-section";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 360, background: "var(--bg)", padding: 16 }}>
      {children}
    </div>
  );
}

const sharedArgs = {
  trackedMacros: ["protein", "carbs", "fat", "fiber"],
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
  formatWaterLine: (ml: number) => `${ml} ml`,
  onAddWaterMl: () => undefined,
  onPressMacro: () => undefined,
};

const meta = {
  title: "Suppr/TodayMacroSection",
  component: TodayMacroSection,
  tags: ["autodocs"],
  render: (args) => (
    <Frame>
      <TodayMacroSection {...args} />
    </Frame>
  ),
  args: {
    ...sharedArgs,
    macroDisplayStyle: "tiles" as const,
  },
} satisfies Meta<typeof TodayMacroSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tiles: Story = {
  args: { macroDisplayStyle: "tiles" },
};

export const Bars: Story = {
  args: { macroDisplayStyle: "bars" },
};

export const Rings: Story = {
  args: { macroDisplayStyle: "rings" },
};
