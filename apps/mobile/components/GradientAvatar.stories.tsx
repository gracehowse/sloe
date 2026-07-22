import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { GradientAvatar } from "./GradientAvatar";

const meta = {
  title: "Mobile/Components/GradientAvatar",
  component: GradientAvatar,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof GradientAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IdentityInk: Story = {
  args: {
    size: 48,
    initial: "G",
    fontSize: 20,
    gradientIdSuffix: "story-ink",
    variant: "ink",
  },
};

export const FrostRing: Story = {
  args: {
    size: 48,
    initial: "G",
    fontSize: 20,
    gradientIdSuffix: "story-frost",
    treatment: "frostRing",
  },
};
