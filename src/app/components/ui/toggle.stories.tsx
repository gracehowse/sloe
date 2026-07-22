import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bold } from "lucide-react";
import { Toggle } from "./toggle";

const meta = {
  component: Toggle,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Pressable on/off control (Radix Toggle). Distinct from Switch — visual pressed state for toolbar-style actions.",
      },
    },
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "aria-label": "Toggle bold",
    children: <Bold />,
  },
};

export const Pressed: Story = {
  args: {
    "aria-label": "Toggle bold",
    defaultPressed: true,
    children: <Bold />,
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    "aria-label": "Toggle bold",
    children: <Bold />,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    "aria-label": "Toggle bold",
    children: <Bold />,
  },
};
