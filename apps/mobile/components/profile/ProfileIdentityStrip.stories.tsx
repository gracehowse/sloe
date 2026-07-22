import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ProfileIdentityStrip } from "./ProfileIdentityStrip";

const meta = {
  title: "Mobile/Profile/ProfileIdentityStrip",
  component: ProfileIdentityStrip,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProfileIdentityStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    monogramInitial: "G",
    displayName: "Grace",
    isPro: true,
    joinedLabel: "Joined Jan 2026",
    recipeCount: 18,
    streak: 12,
  },
};

export const FreeTier: Story = {
  args: {
    monogramInitial: "A",
    displayName: "Alex",
    isPro: false,
    joinedLabel: null,
    recipeCount: 4,
    streak: 0,
  },
};
