import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFullscreen } from "./_mobileStoryDecorators";
import { SloeLaunchWordmark } from "./SloeLaunchWordmark";

const meta = {
  title: "Mobile/Components/SloeLaunchWordmark",
  component: SloeLaunchWordmark,
  tags: ["autodocs"],
  decorators: [mobileStoryFullscreen],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SloeLaunchWordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { width: 200 } };
export const Compact: Story = { args: { width: 160 } };
