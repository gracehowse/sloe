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
  parameters: { layout: "fullscreen" },
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
