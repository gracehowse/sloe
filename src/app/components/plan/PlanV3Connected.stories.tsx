import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanV3Connected } from "./PlanV3Connected";
import { HostStoryProviders, noop } from "../_hostStoryFixtures";
import { noop as planNoop, sampleWeek } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanV3Connected",
  component: PlanV3Connected,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
  },
  decorators: [
    (Story) => (
      <HostStoryProviders>
        <Story />
      </HostStoryProviders>
    ),
  ],
  args: {
    plan: sampleWeek,
    targetCalories: 1830,
    startOffset: 0,
    planStartDate: "2026-06-15",
    onGenerate: planNoop,
    onAdjust: planNoop,
    onSwapSlot: planNoop,
    onOpenShopping: planNoop,
    shoppingItemCount: 23,
    servingCount: 2,
    batchCookSubtitle: "Cook once · scale shopping",
    household: {
      members: [
        { initial: "G", isOwner: true },
        { initial: "S", isOwner: false },
      ],
      servingCount: 2,
      names: "Grace, Sam",
      mismatchEaters: null,
    },
    onOpenHousehold: noop,
    onOpenBatchCook: noop,
    onTemplates: noop,
  },
} satisfies Meta<typeof PlanV3Connected>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileConnected: Story = {};

export const GeneratingWeek: Story = {
  args: { isGenerating: true },
};
