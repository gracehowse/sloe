import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanHeaderV3 } from "./PlanHeaderV3";

const meta = {
  title: "Mobile/Plan/PlanHeaderV3",
  component: PlanHeaderV3,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The Plan header — week-range eyebrow, 'Your plan' title, quiet round action buttons, then the week-verdict row. Under `design_consistency_v1` the eyebrow takes the canonical `Type.eyebrow` ink-caps treatment shared with ScreenSectionChrome and the Today hero, and the actions converge on the shared round chip so Plan matches its siblings. Web twin: src/app/components/plan/PlanHeaderV3.tsx.",
      },
    },
  },
  args: {
    dateRangeLabel: "16–22 June",
    verdict: { tone: "neutral", headline: "On track — 4 of 7 days on target", subline: "3 days need a meal or swap" },
    onGenerate: () => undefined,
    onAdjust: () => undefined,
    onTemplates: () => undefined,
  },
} satisfies Meta<typeof PlanHeaderV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WeekInProgress: Story = {};
export const NoPlanYet: Story = { args: { verdict: null } };

/**
 * `showGenerate={false}` — how the header renders while the empty-week card is
 * up. That card's own "Generate this week" is the screen's one filled CTA, so
 * the Sparkles chip retires rather than firing the same handler twice.
 * Parity with the web header's story of the same name.
 */
export const EmptyWeekNoGenerateChip: Story = {
  args: { verdict: null, showGenerate: false },
};
