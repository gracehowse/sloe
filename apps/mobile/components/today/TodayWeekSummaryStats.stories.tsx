import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayWeekSummaryStats } from "./TodayWeekSummaryStats";

const meta = {
  title: "Mobile/Today/TodayWeekSummaryStats",
  component: TodayWeekSummaryStats,
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
    daysWithFood: 5,
    weekAvgKcal: 1850,
    weekBurnKcal: 420,
    maintenanceTdeeKcal: 2200,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
  },
} satisfies Meta<typeof TodayWeekSummaryStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullWeek: Story = {};
export const SparseWeek: Story = { args: { daysWithFood: 1, weekAvgKcal: 1600 } };
