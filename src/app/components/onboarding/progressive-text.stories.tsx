import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressiveText } from "./progressive-text";

const meta = {
  title: "Suppr/Onboarding/ProgressiveText",
  component: ProgressiveText,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    children: "Still reach your goals",
  },
} satisfies Meta<typeof ProgressiveText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InstantFallback: Story = {
  args: {
    animate: false,
    as: "p",
    className: "text-lg italic text-muted-foreground",
  },
};

export const AnimatedReveal: Story = {
  args: {
    animate: true,
    as: "h1",
    className: "text-4xl font-light lowercase text-foreground",
    "aria-label": "Sloe",
    children: "sloe",
  },
};
