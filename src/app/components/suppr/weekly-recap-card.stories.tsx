import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeeklyRecapCard } from "./weekly-recap-card";

/**
 * WeeklyRecapCard — the shareable weekly recap (ENG-1225 #4). Brand-lacquer
 * SVG card; pins the on-target hero, sparkline (under/over bars), narrative and
 * `sloe.co` watermark in both share ratios.
 */
const meta = {
  title: "Suppr/WeeklyRecapCard",
  component: WeeklyRecapCard,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof WeeklyRecapCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const week = {
  weekLabel: "16–22 Jun",
  onTargetDays: 5,
  dailyCalories: [1980, 2120, 1850, 2460, 1920, 2050, null] as (number | null)[],
  targetCalories: 2100,
  narrative: "A steady, consistent week.",
};

export const Portrait: Story = {
  name: "Portrait (4:5 story)",
  args: { ...week, ratio: "portrait", width: 320 },
};

export const Square: Story = {
  name: "Square (1:1 feed)",
  args: { ...week, ratio: "square", width: 360 },
};

export const PerfectWeek: Story = {
  name: "7/7 perfect week",
  args: {
    ...week,
    onTargetDays: 7,
    dailyCalories: [1980, 2020, 1850, 2060, 1920, 2050, 1990],
    narrative: "Your most consistent week this month.",
    ratio: "portrait",
    width: 320,
  },
};
