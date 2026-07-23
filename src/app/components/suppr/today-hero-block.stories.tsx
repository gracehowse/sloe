import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TodayHeroBlock } from "./today-hero-block";

const noop = () => undefined;
const selectedDate = new Date("2026-07-22T12:00:00");
const todayKey = "2026-07-22";

const baseArgs = {
  totals: { calories: 1240, protein: 92, carbs: 118, fat: 42 },
  effectiveMacroTargets: { protein: 140, carbs: 220, fat: 65 },
  effectiveCalorieTarget: 2000,
  baseCalorieTarget: 2000,
  totalBurnKcal: 420,
  aiSourcedCount: 0,
  ringExpanded: false,
  onToggleExpanded: noop,
  pulse: false,
  commitPulse: false,
  logConfirmVisible: false,
  tdeeLearnDays: 4,
  onPressStatusChip: noop,
  onOpenCoach: noop,
  hasActiveFast: false,
  isTodaySelected: true,
  selectedDate,
  byDay: {
    [todayKey]: [{ name: "Breakfast" }, { name: "Lunch" }],
  },
  isFreshDay: false,
  onLogFreshDaySlot: noop,
};

function DesktopFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 640, background: "var(--bg)", padding: 16 }}>{children}</div>
  );
}

const meta = {
  title: "Suppr/TodayHeroBlock",
  component: TodayHeroBlock,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    viewport: { defaultViewport: "desktop" },
    docs: {
      description: {
        component:
          "Today calorie hero block — coach-line dispatch + TodayHeroStats (ENG-1653). Web mirror of mobile TodayHeroBlock.",
      },
    },
  },
  decorators: [
    (Story) => (
      <DesktopFrame>
        <Story />
      </DesktopFrame>
    ),
  ],
  beforeEach() {
    const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
    w.__SUPPR_FORCE_FLAGS__ = { coach_screen_v1: true };
    return () => {
      delete w.__SUPPR_FORCE_FLAGS__;
    };
  },
  args: baseArgs,
} satisfies Meta<typeof TodayHeroBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderTarget: Story = {};

export const FreshDay: Story = {
  args: {
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    isFreshDay: true,
    byDay: { [todayKey]: [] },
  },
};

export const OverTarget: Story = {
  args: {
    totals: { calories: 2380, protein: 150, carbs: 210, fat: 88 },
    effectiveCalorieTarget: 2000,
  },
};
