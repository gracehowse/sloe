import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayActivityBonusCard } from "./TodayActivityBonusCard";

const meta = {
  title: "Mobile/Today/TodayActivityBonusCard",
  component: TodayActivityBonusCard,
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
    isToday: true,
    hasBurnData: true,
    totalBurnKcal: 1720,
    consumedCalories: 1240,
    effectiveCalorieGoal: 2000,
    basalBurnKcal: 1400,
    activityBurnKcal: 320,
    todayActivityBudgetAddon: 0,
    potentialActivityBudgetAddon: 180,
    dayWorkouts: [],
    trackerWeekSummaryKeys: [],
    activityBurnByDay: {},
    basalBurnByDay: {},
    byDay: {},
    weekSummaryMode: "today",
    onOpenBurnDetail: noop,
    styles: {},
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    borderColor: c.border,
    cardColor: c.card,
    cardBorderColor: c.border,
    maintenanceTdeeKcal: 2200,
  },
} satisfies Meta<typeof TodayActivityBonusCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithBurnData: Story = {};
export const DiscoverBanner: Story = { args: { hasBurnData: false, potentialActivityBudgetAddon: 180 } };
