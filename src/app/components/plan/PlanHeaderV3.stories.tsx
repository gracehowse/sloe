import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanHeaderV3 } from "./PlanHeaderV3";
import { noop, PlanMobileFrame, sampleWeek, verdictFor } from "./_planStoryFixtures";

const meta = {
  title: "Plan/PlanHeaderV3",
  component: PlanHeaderV3,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The Plan header — week-range eyebrow, 'Your plan' title, quiet round action buttons, then the week-verdict row. Under `design_consistency_v1` the eyebrow takes the canonical 11/600/0.12em full-ink treatment shared with ScreenChrome and the Today hero, and the three actions become the shared 40px muted `IconButton` chip so Plan stops being the one surface with white rounded-square card buttons. Mobile twin: apps/mobile/components/plan/PlanHeaderV3.tsx.",
      },
    },
  },
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

/**
 * `showGenerate={false}` — how the header renders while the empty-week card is
 * up. That card's own "Generate this week" is the screen's one filled CTA, so
 * the Sparkles chip retires rather than firing the same handler twice.
 */
export const EmptyWeekNoGenerateChip: Story = {
  args: { verdict: null, showGenerate: false },
};
