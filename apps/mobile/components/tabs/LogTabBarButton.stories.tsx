import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { LogTabBarButton } from "./LogTabBarButton";

const meta = {
  title: "Mobile/Tabs/LogTabBarButton",
  component: LogTabBarButton,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LogTabBarButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onPress: () => undefined } };
export const Interactive: Story = { args: { onPress: () => undefined } };
