import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bell, Calendar, MoreHorizontal, X } from "lucide-react";
import { IconButton } from "./icon-button";

const meta = {
  component: IconButton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Anatomy role **IconButton** — circular icon controls (bell, calendar, kebab, close). Sizes on the Spacing ladder: sm=32, md=40. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
  argTypes: {
    size: { control: "radio", options: ["sm", "md", "lg"] },
    variant: { control: "radio", options: ["muted", "ghost"] },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MutedMd: Story = {
  args: {
    size: "md",
    variant: "muted",
    icon: Bell,
    "aria-label": "Notifications",
  },
};

export const MutedSm: Story = {
  args: {
    size: "sm",
    variant: "muted",
    icon: Calendar,
    "aria-label": "Calendar",
  },
};

export const Ghost: Story = {
  args: {
    size: "md",
    variant: "ghost",
    icon: MoreHorizontal,
    "aria-label": "More",
  },
};

export const Close: Story = {
  args: {
    size: "sm",
    variant: "ghost",
    icon: X,
    "aria-label": "Close",
  },
};
