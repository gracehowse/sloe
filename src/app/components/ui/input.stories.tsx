import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";

const meta = {
  component: Input,
  tags: ["ai-generated"],
  args: { "aria-label": "Email address" },
  argTypes: {
    type: { control: "text" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "you@example.com" },
};

export const Email: Story = {
  args: { type: "email", defaultValue: "chef@suppr.app" },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Locked field" },
};

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "not-an-email" },
};
