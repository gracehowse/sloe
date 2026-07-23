import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SupprButton } from "./suppr-button";

const meta = {
  title: "Suppr/SupprButton",
  component: SupprButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Shared CTA primitive — primary (solid aubergine) or ghost; optional loading + sm size.",
      },
    },
  },
  args: {
    onClick: () => undefined,
  },
} satisfies Meta<typeof SupprButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary", label: "Log it" },
};

export const Ghost: Story = {
  args: { variant: "ghost", label: "Not now" },
};

export const Loading: Story = {
  args: { variant: "primary", label: "Saving", loading: true },
};

export const Small: Story = {
  name: "Small (compact)",
  args: { variant: "primary", size: "sm", label: "Save" },
};

export const Disabled: Story = {
  args: { variant: "primary", label: "Unavailable", disabled: true },
};
