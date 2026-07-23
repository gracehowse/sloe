import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RenameSavedMealDialog } from "./rename-saved-meal-dialog";

const meta = {
  title: "Suppr/RenameSavedMealDialog",
  component: RenameSavedMealDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Rename a saved usual meal — themed replacement for window.prompt.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof RenameSavedMealDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { currentName: "My usual breakfast" },
};

export const LongName: Story = {
  args: {
    currentName: "Weekday oats with berries and protein powder",
  },
};
