import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanEmptyWeekCard } from "./PlanEmptyWeekCard";
import { noop, PlanMobileFrame } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanEmptyWeekCard",
  component: PlanEmptyWeekCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    onGenerate: noop,
    onAddMealsAsYouGo: noop,
  },
} satisfies Meta<typeof PlanEmptyWeekCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Generating: Story = {
  args: { isGenerating: true },
};
