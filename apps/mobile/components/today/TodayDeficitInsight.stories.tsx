import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

const todayKey = "2026-06-21";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayDeficitInsight } from "./TodayDeficitInsight";

const meta = {
  title: "Mobile/Today/TodayDeficitInsight",
  component: TodayDeficitInsight,
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
    remaining: 620,
    selectedDateKey: todayKey,
    slotsLogged: ["Breakfast", "Lunch"],
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
  },
} satisfies Meta<typeof TodayDeficitInsight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RoomForDinner: Story = {};
export const NoRoom: Story = { args: { remaining: 0 } };
