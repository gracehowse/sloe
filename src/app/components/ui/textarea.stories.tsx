import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./textarea";

const meta = {
  component: Textarea,
  tags: ["ai-generated"],
  args: { "aria-label": "Recipe notes" },
  argTypes: {
    disabled: { control: "boolean" },
    rows: { control: "number" },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Add a note about this meal…", rows: 4 },
};

export const Filled: Story = {
  args: { defaultValue: "Swap the cream for Greek yoghurt to cut the fat.", rows: 4 },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Read-only note", rows: 4 },
};
