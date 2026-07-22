import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ProgressTabChrome } from "./ProgressTabChrome";

const meta = {
  title: "Mobile/Tabs/ProgressTabChrome",
  component: ProgressTabChrome,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProgressTabChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithTrailing: Story = {
  args: { trailing: <span style={{ fontSize: 12 }}>Share</span> },
};
