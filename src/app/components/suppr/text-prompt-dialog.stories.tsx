import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextPromptDialog } from "./text-prompt-dialog";

const meta = {
  title: "Suppr/TextPromptDialog",
  component: TextPromptDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Themed single-text-input prompt — themed replacement for window.prompt.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof TextPromptDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RenamePlan: Story = {
  args: {
    title: "Rename plan",
    description: "Choose a short name for this meal plan.",
    inputLabel: "Name",
    currentValue: "July cut",
    placeholder: "Plan name",
  },
};

export const Empty: Story = {
  args: {
    title: "Name this meal",
    placeholder: "e.g. My usual breakfast",
    currentValue: "",
  },
};
