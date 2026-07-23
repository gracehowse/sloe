import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { WeeklyInsightCard } from "./WeeklyInsightCard";

const meta = {
  title: "Mobile/Today/WeeklyInsightCard",
  component: WeeklyInsightCard,
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
    householdSize: 2,
    loggedDaysInWeek: 5,
    weekAvgKcal: 1850,
    weekDailyKcal: [1900, 1800, 0, 2100, 1750, 2000, 1600],
    dailyKcalTarget: 2000,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    cardBackgroundColor: c.card,
    borderColor: c.border,
  },
} satisfies Meta<typeof WeeklyInsightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadedWeek: Story = {};
export const EmptyWeek: Story = { args: { loggedDaysInWeek: 0, weekAvgKcal: null, weekDailyKcal: [0,0,0,0,0,0,0] } };
