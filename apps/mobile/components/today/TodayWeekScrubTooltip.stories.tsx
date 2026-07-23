import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayWeekScrubTooltip } from "./TodayWeekScrubTooltip";
import type { TodayWeekDay } from "./TodayWeekTypes";

const c = Colors.light;
const noop = () => undefined;

const day: TodayWeekDay = {
  key: "2026-06-18",
  short: "Thu",
  date: new Date(2026, 5, 18),
  totals: { calories: 2100, protein: 130, carbs: 195, fat: 62 },
};

const meta = {
  title: "Mobile/Today/TodayWeekScrubTooltip",
  component: TodayWeekScrubTooltip,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div
          style={{
            position: "relative",
            width: 360,
            height: 160,
            padding: 16,
            background: "#F7F6FA",
          }}
        >
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    day,
    dayGoal: 2000,
    cardColor: c.card,
    borderColor: c.border,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    indexInWeek: 3,
    weekLength: 7,
    onDismiss: noop,
  },
} satisfies Meta<typeof TodayWeekScrubTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OverTarget: Story = {};

export const UnderTarget: Story = {
  args: {
    day: { ...day, totals: { ...day.totals, calories: 1640 } },
    dayGoal: 2000,
    indexInWeek: 1,
  },
};
