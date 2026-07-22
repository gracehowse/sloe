import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProfileHubHeader } from "./ProfileHubHeader";

const meta = {
  title: "Suppr/Profile/ProfileHubHeader",
  component: ProfileHubHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    avatarInitial: "G",
    displayName: "Grace",
    tierLabel: "Pro",
    isPro: true,
    joinedLabel: "Joined 2mo ago",
    recipeCount: 14,
    streakDays: 5,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 390 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileHubHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProAccount: Story = {};

export const FreeAccount: Story = {
  args: {
    tierLabel: "Free",
    isPro: false,
    recipeCount: 2,
    streakDays: 1,
  },
};
