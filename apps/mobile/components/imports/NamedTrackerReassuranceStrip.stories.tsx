import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { NamedTrackerReassuranceStrip } from "./NamedTrackerReassuranceStrip";

const meta = {
  title: "Mobile/Imports/NamedTrackerReassuranceStrip",
  component: NamedTrackerReassuranceStrip,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NamedTrackerReassuranceStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const CustomTestId: Story = { args: { testID: "story-tracker-strip" } };
