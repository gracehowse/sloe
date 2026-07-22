import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayHeroStats } from "./TodayHeroStats";

const meta = {
  title: "Mobile/Today/TodayHeroStats",
  component: TodayHeroStats,
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
    goal: 2000,
    consumed: 1240,
    baseGoal: 2000,
    textColor: c.text,
    secondaryColor: c.textSecondary,
    suppressZeroBonus: false,
  },
} satisfies Meta<typeof TodayHeroStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NormalDay: Story = {};
export const FreshDay: Story = { args: { consumed: 0, suppressZeroBonus: true } };
