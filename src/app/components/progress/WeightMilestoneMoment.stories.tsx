import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeightMilestoneMoment } from "./WeightMilestoneMoment";

const meta = {
  title: "Suppr/Progress/WeightMilestoneMoment",
  component: WeightMilestoneMoment,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    ordinal: 5,
    onComplete: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", width: 220, height: 120, background: "var(--card)", borderRadius: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeightMilestoneMoment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FifthMilestone: Story = {};

export const TenthMilestone: Story = {
  args: { ordinal: 10 },
};

export const HiddenWhenNull: Story = {
  args: { ordinal: null },
};
