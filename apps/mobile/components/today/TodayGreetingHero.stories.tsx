import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayGreetingHero } from "./TodayGreetingHero";

const meta = {
  title: "Mobile/Today/TodayGreetingHero",
  component: TodayGreetingHero,
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
  args: { viewMode: "day", isToday: true, selectedDate: new Date("2026-06-21T12:00:00") },
} satisfies Meta<typeof TodayGreetingHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TodayDayView: Story = {};
export const PastDay: Story = { args: { isToday: false, selectedDate: new Date("2026-06-15T12:00:00") } };
