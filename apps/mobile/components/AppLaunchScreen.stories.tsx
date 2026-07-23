import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFullscreen } from "./_mobileStoryDecorators";
import { AppLaunchScreen } from "./AppLaunchScreen";

const meta = {
  title: "Mobile/Components/AppLaunchScreen",
  component: AppLaunchScreen,
  tags: ["autodocs"],
  decorators: [mobileStoryFullscreen],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppLaunchScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = { args: { scheme: "light", message: "Loading…" } };
export const Dark: Story = { args: { scheme: "dark", message: "Loading…" } };
