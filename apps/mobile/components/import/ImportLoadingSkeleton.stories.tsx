import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ImportLoadingSkeleton } from "./ImportLoadingSkeleton";

const meta = {
  title: "Mobile/Import/ImportLoadingSkeleton",
  component: ImportLoadingSkeleton,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ImportLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checking: Story = { args: { phase: "checking", onCancel: () => undefined } };
export const Importing: Story = {
  args: {
    phase: "importing",
    completedSteps: ["ingredients"],
    onCancel: () => undefined,
  },
};
