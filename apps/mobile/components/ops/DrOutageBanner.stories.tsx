import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStorySafeArea } from "../_mobileStoryDecorators";
import { DrOutageBanner } from "./DrOutageBanner";

const meta = {
  title: "Mobile/Ops/DrOutageBanner",
  component: DrOutageBanner,
  tags: ["autodocs"],
  decorators: [mobileStorySafeArea],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DrOutageBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Analytics stub returns all flags ON — banner renders when flag is enabled. */
export const Default: Story = {};
export const FlaggedOn: Story = {};
