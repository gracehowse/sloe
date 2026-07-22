import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanHouseholdBannerV3 } from "./PlanHouseholdBannerV3";
import { noop, PlanMobileFrame } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanHouseholdBannerV3",
  component: PlanHouseholdBannerV3,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => <PlanMobileFrame><Story /></PlanMobileFrame>],
  args: {
    members: [
      { initial: "G", isOwner: true },
      { initial: "S", isOwner: false },
      { initial: "M", isOwner: false },
    ],
    servingCount: 3,
    names: "Grace, Sam, Mia",
    mismatchEaters: null,
    onPress: noop,
  },
} satisfies Meta<typeof PlanHouseholdBannerV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MatchedServings: Story = {};

export const ServingMismatch: Story = {
  args: {
    servingCount: 2,
    mismatchEaters: 3,
  },
};
