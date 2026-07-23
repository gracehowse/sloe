import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CompleteDayV3Section } from "./CompleteDayV3Section";

const meta = {
  title: "Suppr/CompleteDayV3Section",
  component: CompleteDayV3Section,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Complete Day v3 recap — eaten vs target stats, weight projection trendline, and coach quote.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    dayLabel: "Tuesday 22 Jul",
    eatenKcal: 1842,
    targetKcal: 1900,
    proteinG: 128,
    proteinTargetG: 130,
    currentWeightKg: 72.4,
    projectedWeightKg: 71.6,
    projectionWeeks: 8,
    measurementSystem: "metric" as const,
  },
} satisfies Meta<typeof CompleteDayV3Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderTarget: Story = {};

export const OverTarget: Story = {
  args: {
    eatenKcal: 2180,
    targetKcal: 1900,
    proteinG: 96,
    proteinTargetG: 130,
  },
};

export const Imperial: Story = {
  args: {
    measurementSystem: "imperial",
    currentWeightKg: 72.4,
    projectedWeightKg: 71.6,
  },
};
