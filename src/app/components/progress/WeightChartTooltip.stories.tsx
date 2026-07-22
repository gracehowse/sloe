import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeightChartTooltip } from "./WeightChartTooltip";

const meta = {
  title: "Suppr/Progress/WeightChartTooltip",
  component: WeightChartTooltip,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    unit: "kg",
    active: true,
    label: "12 Jun",
    payload: [{ value: 68.4 }],
  },
} satisfies Meta<typeof WeightChartTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Kilograms: Story = {};

export const Pounds: Story = {
  args: {
    unit: "lb",
    payload: [{ value: 150.8 }],
  },
};

export const Inactive: Story = {
  args: { active: false },
};
