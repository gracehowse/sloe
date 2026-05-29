import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Separator } from "./separator";

const meta = {
  component: Separator,
  tags: ["ai-generated"],
  argTypes: {
    orientation: {
      control: "inline-radio",
      options: ["horizontal", "vertical"],
    },
    decorative: { control: "boolean" },
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: { className: "w-40" },
};

export const Vertical: Story = {
  args: { orientation: "vertical", className: "h-10" },
};

export const NonDecorative: Story = {
  args: { decorative: false, className: "w-40" },
};
