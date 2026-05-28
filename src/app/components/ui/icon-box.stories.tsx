import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Droplets, Drumstick } from "lucide-react";
import { IconBox } from "./icon-box";

const meta = {
  component: IconBox,
  tags: ["ai-generated"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg", "xl"] },
    tone: {
      control: "select",
      options: [
        "primary",
        "success",
        "warning",
        "destructive",
        "protein",
        "carbs",
        "fat",
        "water",
        "slot-breakfast",
        "slot-lunch",
        "slot-dinner",
        "slot-snack",
        "muted",
        "ghost",
      ],
    },
  },
} satisfies Meta<typeof IconBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Protein: Story = {
  args: { tone: "protein", size: "md", children: <Drumstick aria-hidden /> },
};
export const Water: Story = {
  args: { tone: "water", size: "lg", children: <Droplets aria-hidden /> },
};
export const Destructive: Story = {
  args: { tone: "destructive", size: "sm", children: <Drumstick aria-hidden /> },
};
export const Muted: Story = {
  args: { tone: "muted", size: "md", children: <Drumstick aria-hidden /> },
};
export const Ghost: Story = {
  args: { tone: "ghost", size: "xl", children: <Droplets aria-hidden /> },
};
export const SlotBreakfast: Story = {
  args: { tone: "slot-breakfast", size: "md", children: <Drumstick aria-hidden /> },
};
