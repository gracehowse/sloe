import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";

const meta = {
  component: Badge,
  tags: ["ai-generated"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Pro" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "per serving" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Beta" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Over target" },
};

export const AsChild: Story = {
  args: {
    asChild: true,
    children: <a href="/pricing">Pro</a>,
  },
};
