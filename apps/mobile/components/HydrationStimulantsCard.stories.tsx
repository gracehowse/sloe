import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { HydrationStimulantsCard } from "./HydrationStimulantsCard";

const noop = () => undefined;

const meta = {
  title: "Mobile/Components/HydrationStimulantsCard",
  component: HydrationStimulantsCard,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HydrationStimulantsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidDay: Story = {
  args: {
    selectedDateKey: "2026-07-22",
    weekStartDay: "monday",
    targets: { waterMl: 2500, caffeineMg: 400, alcoholGWeekly: 140 },
    waterTotalMl: 1200,
    waterFromMealsMl: 200,
    caffeineTotalMg: 120,
    alcoholByDayG: { "2026-07-22": 0 },
    onAddWater: noop,
    onAddCaffeine: noop,
    onAddAlcohol: noop,
    onReset: noop,
  },
};

export const OverWaterTarget: Story = {
  args: {
    selectedDateKey: "2026-07-22",
    weekStartDay: "monday",
    targets: { waterMl: 2000, caffeineMg: 0, alcoholGWeekly: 0 },
    waterTotalMl: 2400,
    waterFromMealsMl: 0,
    caffeineTotalMg: 0,
    alcoholByDayG: {},
    onAddWater: noop,
    onAddCaffeine: noop,
    onAddAlcohol: noop,
    onReset: noop,
  },
};
