import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ReferralRewardCard } from "./ReferralRewardCard";

const meta = {
  title: "Mobile/Household/ReferralRewardCard",
  component: ReferralRewardCard,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ReferralRewardCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: {
    loading: false,
    error: null,
    reward: {
      code: "DEMO123",
      referralUrl: "https://getsloe.com/g/DEMO123",
    },
  },
};

export const Loading: Story = {
  args: { loading: true, error: null, reward: null },
};
