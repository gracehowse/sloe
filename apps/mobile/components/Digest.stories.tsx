import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, DIGEST_SUCCESS_ARGS } from "./_mobileStoryDecorators";
import { Digest } from "./Digest";

const meta = {
  title: "Mobile/Components/Digest",
  component: Digest,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Digest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = { args: { ...DIGEST_SUCCESS_ARGS, state: "success" } };
export const Loading: Story = { args: { ...DIGEST_SUCCESS_ARGS, state: "loading" } };
