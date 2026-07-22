import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { ImplausibleMacrosNotice } from "./ImplausibleMacrosNotice";

function ImplausibleMacrosNoticeStory(
  props: Omit<
    ComponentProps<typeof ImplausibleMacrosNotice>,
    "acknowledged" | "onAcknowledgedChange"
  >,
) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <ImplausibleMacrosNotice
      {...props}
      acknowledged={acknowledged}
      onAcknowledgedChange={setAcknowledged}
    />
  );
}

const meta = {
  title: "Suppr/ImplausibleMacrosNotice",
  component: ImplausibleMacrosNoticeStory,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Inline warning when custom-food macros fail server plausibility — user must acknowledge to save anyway.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    open: true,
  },
} satisfies Meta<typeof ImplausibleMacrosNoticeStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hidden: Story = {
  args: { open: false },
};
