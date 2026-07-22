import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { SloeHeaderWordmark } from "./SloeHeaderWordmark";

const meta = {
  title: "Mobile/Components/SloeHeaderWordmark",
  component: SloeHeaderWordmark,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SloeHeaderWordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeaderSize: Story = { args: { fontSize: 22 } };
export const Large: Story = { args: { fontSize: 48 } };
