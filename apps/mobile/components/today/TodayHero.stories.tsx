import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayHero } from "./TodayHero";

const meta = {
  title: "Mobile/Today/TodayHero",
  component: TodayHero,
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
    isOnTrack: true,
    proteinPct: 0.35,
    carbsPct: 0.4,
    fatPct: 0.25,
    mealsToday: [],
    textColor: c.text,
    secondaryColor: c.textSecondary,
    trackColor: c.border,
    cardBackgroundColor: c.card,
    borderColor: c.border,
    textTertiaryColor: c.textTertiary,
    onToggleExpanded: noop,
    expanded: false,
  },
} satisfies Meta<typeof TodayHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrack: Story = {};
export const WithCoach: Story = { args: { onPressCoach: noop } };
