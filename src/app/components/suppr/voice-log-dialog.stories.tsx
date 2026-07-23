import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VoiceLogDialog } from "./voice-log-dialog";

const meta = {
  title: "Suppr/VoiceLogDialog",
  component: VoiceLogDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "AI voice logging dialog — forced open on the input stage (no live parse).",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onCommit: () => undefined,
    activeSlot: "Dinner",
  },
} satisfies Meta<typeof VoiceLogDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Input: Story = {};

export const BreakfastSlot: Story = {
  args: { activeSlot: "Breakfast" },
};
