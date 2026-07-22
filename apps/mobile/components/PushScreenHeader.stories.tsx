import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStorySafeArea } from "./_mobileStoryDecorators";
import { PushScreenHeader } from "./PushScreenHeader";

const meta = {
  title: "Mobile/Components/PushScreenHeader",
  component: PushScreenHeader,
  tags: ["autodocs"],
  decorators: [mobileStorySafeArea],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PushScreenHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: "Burn detail", caption: "Today", onBack: () => undefined },
};

export const WithRightSlot: Story = {
  args: {
    title: "Settings",
    onBack: () => undefined,
    rightSlot: <span style={{ fontSize: 12, color: "#6A6072" }}>Pro</span>,
  },
};
