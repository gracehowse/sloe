import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { PlanSubTabHeader } from "./PlanSubTabHeader";

function Harness({ unchecked = 0 }: { unchecked?: number }) {
  const [value, setValue] = React.useState<"plan" | "shopping">("plan");
  return (
    <PlanSubTabHeader
      value={value}
      onChange={setValue}
      shoppingUncheckedCount={unchecked}
    />
  );
}

const meta = {
  title: "Mobile/Tabs/PlanSubTabHeader",
  component: Harness,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ShoppingBadge: Story = { args: { unchecked: 4 } };
