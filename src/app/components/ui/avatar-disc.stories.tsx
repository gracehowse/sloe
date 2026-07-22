import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AvatarDisc } from "./avatar-disc";

const meta = {
  component: AvatarDisc,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Initials avatar disc — the identity / household-member monogram primitive (S5 avatar ruling). Decorative by default; the parent control owns the accessible name.",
      },
    },
  },
} satisfies Meta<typeof AvatarDisc>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Identity: Story = {
  args: {
    initial: "G",
    size: 36,
    fill: "identity",
  },
};

export const Member: Story = {
  args: {
    initial: "A",
    size: 36,
    fill: "member",
    accent: "var(--accent-info)",
  },
};

export const FrostRing: Story = {
  args: {
    initial: "G",
    size: 52,
    fill: "identity",
    treatment: "frostRing",
  },
};
