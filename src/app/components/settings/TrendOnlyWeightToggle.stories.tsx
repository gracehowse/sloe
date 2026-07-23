import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TrendOnlyWeightToggle } from "./TrendOnlyWeightToggle";

const meta = {
  title: "Settings/TrendOnlyWeightToggle",
  component: TrendOnlyWeightToggle,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrendOnlyWeightToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WideLayout: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 560, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};
