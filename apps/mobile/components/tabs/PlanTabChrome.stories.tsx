import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { PlanTabChrome } from "./PlanTabChrome";

function Harness() {
  const [tab, setTab] = React.useState<"plan" | "shopping">("plan");
  return (
    <PlanTabChrome
      value={tab}
      onChange={setTab}
      subtitle="14–20 Jul"
      shoppingUncheckedCount={3}
    />
  );
}

const meta = {
  title: "Mobile/Tabs/PlanTabChrome",
  component: Harness,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ShoppingSelected: Story = {
  render: () => {
    const [tab, setTab] = React.useState<"plan" | "shopping">("shopping");
    return (
      <PlanTabChrome value={tab} onChange={setTab} title="Shopping list" shoppingUncheckedCount={8} />
    );
  },
};
