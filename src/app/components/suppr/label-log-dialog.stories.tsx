import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LabelLogDialog } from "./label-log-dialog";

const meta = {
  title: "Suppr/LabelLogDialog",
  component: LabelLogDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Nutrition-label logging dialog — forced open on the capture stage.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onCommit: () => undefined,
    activeSlot: "Snacks",
  },
} satisfies Meta<typeof LabelLogDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Capture: Story = {};

export const LunchSlot: Story = {
  args: { activeSlot: "Lunch" },
};
