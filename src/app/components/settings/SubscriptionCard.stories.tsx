import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SubscriptionCard } from "./SubscriptionCard";
import { noop } from "../_hostStoryFixtures";

const meta = {
  title: "Settings/SubscriptionCard",
  component: SubscriptionCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    userTier: "free",
    onManageSubscription: noop,
  },
} satisfies Meta<typeof SubscriptionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreeTier: Story = {};

export const ProLoading: Story = {
  args: { userTier: "pro" },
};
