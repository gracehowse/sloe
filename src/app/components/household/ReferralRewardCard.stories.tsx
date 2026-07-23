import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReferralRewardCard } from "./ReferralRewardCard";

const meta = {
  title: "Suppr/Household/ReferralRewardCard",
  component: ReferralRewardCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    loading: false,
    error: null,
    reward: {
      referralUrl: "https://suppr.club/r/grace",
      code: "grace",
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReferralRewardCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
    reward: null,
  },
};

export const Error: Story = {
  args: {
    error: "network",
    reward: null,
  },
};
