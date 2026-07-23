import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_SHEET_COLORS } from "./_mobileStoryDecorators";
import ImplausibleMacrosNotice from "./ImplausibleMacrosNotice";

const meta = {
  title: "Mobile/Components/ImplausibleMacrosNotice",
  component: ImplausibleMacrosNotice,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ImplausibleMacrosNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unacknowledged: Story = {
  args: {
    visible: true,
    acknowledged: false,
    onToggle: () => undefined,
    colors: MOCK_SHEET_COLORS,
  },
};

export const Acknowledged: Story = {
  args: {
    visible: true,
    acknowledged: true,
    onToggle: () => undefined,
    colors: MOCK_SHEET_COLORS,
  },
};
