import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

const selectedDate = new Date("2026-06-21T12:00:00");
const loggedDays = new Set(["2026-06-15", "2026-06-16", "2026-06-18", "2026-06-21"]);

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayDateHeader } from "./TodayDateHeader";

const meta = {
  title: "Mobile/Today/TodayDateHeader",
  component: TodayDateHeader,
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
    viewMode: "day",
    onViewModeChange: noop,
    selectedDate,
    weekLabel: "16–22 Jun",
    isToday: true,
    formatDateLabel: (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }),
    weekStartDay: "monday",
    loggedDays,
    protectedDateKeys: new Set<string>(),
    onSelectDate: noop,
    onOpenCalendar: noop,
    onNavigatePrev: noop,
    onNavigateNext: noop,
    onTapTitle: noop,
    avatarLetter: "G",
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    cardColor: c.card,
    cardBorderColor: c.border,
    primaryForegroundColor: c.primaryForeground,
    streakDays: 4,
    dayGreeting: "Good afternoon",
  },
} satisfies Meta<typeof TodayDateHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayView: Story = {};
export const StripOnly: Story = { args: { stripOnly: true, hideViewModeToggle: true } };
