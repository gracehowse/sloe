import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

const selectedDate = new Date("2026-07-22T12:00:00");
const todayKey = "2026-07-22";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayHeroBlock } from "./TodayHeroBlock";

const baseArgs = {
  entranceStyle: undefined,
  totals: { calories: 1240, protein: 92, carbs: 118, fat: 42 },
  effectiveMacroTargets: { protein: 140, carbs: 220, fat: 65 },
  effectiveCalorieGoal: 2000,
  baseGoal: 2000,
  textColor: c.text,
  textSecondaryColor: c.textSecondary,
  textTertiaryColor: c.textTertiary,
  cardBackgroundColor: c.card,
  borderColor: c.border,
  trackColor: c.border,
  ringExpanded: false,
  onToggleExpanded: noop,
  tdeeLearnDays: 4,
  onPressStatusChip: noop,
  onOpenCoach: noop,
  hasActiveFast: false,
  isToday: true,
  remaining: 760,
  selectedDate,
  byDay: {
    [todayKey]: [{ name: "Breakfast" }, { name: "Lunch" }],
  },
  logConfirmBump: 0,
  isFreshDay: false,
  onLogFreshDaySlot: noop,
};

const meta = {
  title: "Mobile/Today/TodayHeroBlock",
  component: TodayHeroBlock,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Today calorie hero block with entrance wrapper — coach-line dispatch + TodayHero (ENG-1653).",
      },
    },
  },
  args: baseArgs,
} satisfies Meta<typeof TodayHeroBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderTarget: Story = {};

export const FreshDay: Story = {
  args: {
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    remaining: 2000,
    isFreshDay: true,
    byDay: { [todayKey]: [] },
  },
};

export const OverTarget: Story = {
  args: {
    totals: { calories: 2380, protein: 150, carbs: 210, fat: 88 },
    effectiveCalorieGoal: 2000,
    remaining: 0,
  },
};
