import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanHeaderV3 } from "./PlanHeaderV3";
import { noop, PlanMobileFrame, sampleWeek, verdictFor } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanHeaderV3",
  component: PlanHeaderV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    dateRangeLabel: "15–21 June",
    verdict: verdictFor(sampleWeek),
    onGenerate: noop,
    onAdjust: noop,
    onTemplates: noop,
  },
} satisfies Meta<typeof PlanHeaderV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrackWeek: Story = {};

export const BeforePlanExists: Story = {
  args: { verdict: null },
};
