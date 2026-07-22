import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayHeroRing } from "./TodayHeroRing";

const meta = {
  title: "Mobile/Today/TodayHeroRing",
  component: TodayHeroRing,
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
    consumed: 1240,
    goal: 2000,
    baseGoal: 2000,
    textColor: c.text,
    secondaryColor: c.textSecondary,
    trackColor: c.border,
    cardBackgroundColor: c.card,
    borderColor: c.border,
    proteinPct: 0.35,
    carbsPct: 0.4,
    fatPct: 0.25,
    expanded: false,
    onToggleExpanded: noop,
    textTertiaryColor: c.textTertiary,
    onPressStatusChip: noop,
  },
} satisfies Meta<typeof TodayHeroRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderBudget: Story = {};
export const OverBudget: Story = { args: { consumed: 2380, onPressCoach: noop } };
