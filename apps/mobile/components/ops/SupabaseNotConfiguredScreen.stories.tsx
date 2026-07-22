import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFullscreen } from "../_mobileStoryDecorators";
import { SupabaseNotConfiguredScreen } from "./SupabaseNotConfiguredScreen";

const meta = {
  title: "Mobile/Ops/SupabaseNotConfiguredScreen",
  component: SupabaseNotConfiguredScreen,
  tags: ["autodocs"],
  decorators: [mobileStoryFullscreen],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SupabaseNotConfiguredScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = { args: { resolved: "light" } };
export const Dark: Story = { args: { resolved: "dark" } };
