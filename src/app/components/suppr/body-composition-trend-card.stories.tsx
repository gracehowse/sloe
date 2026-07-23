import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BodyCompositionTrendCard } from "./body-composition-trend-card";

const meta = {
  title: "Suppr/BodyCompositionTrendCard",
  component: BodyCompositionTrendCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Progress body-composition card — Pro trends when data exists; Free/Base see a factual upsell.",
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
} satisfies Meta<typeof BodyCompositionTrendCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreeUpsell: Story = {
  args: {
    userTier: "free",
  },
};

export const ProEmpty: Story = {
  args: {
    userTier: "pro",
  },
};
