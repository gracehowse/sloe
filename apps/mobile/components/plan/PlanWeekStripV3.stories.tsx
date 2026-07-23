import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanWeekStripV3 } from "./PlanWeekStripV3";

const meta = {
  title: "Mobile/Plan/PlanWeekStripV3",
  component: PlanWeekStripV3,
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
    days: [
      { key: "d1", dayLetter: "M", dateNum: 16, status: "full", isToday: false },
      { key: "d2", dayLetter: "T", dateNum: 17, status: "part", isToday: false },
      { key: "d3", dayLetter: "W", dateNum: 18, status: "empty", isToday: true },
      { key: "d4", dayLetter: "T", dateNum: 19, status: "full", isToday: false },
      { key: "d5", dayLetter: "F", dateNum: 20, status: "part", isToday: false },
      { key: "d6", dayLetter: "S", dateNum: 21, status: "empty", isToday: false },
      { key: "d7", dayLetter: "S", dateNum: 22, status: "full", isToday: false },
    ],
    selectedKey: "d3",
    onSelectDay: () => undefined,
  },
} satisfies Meta<typeof PlanWeekStripV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedStatuses: Story = {};
export const TodaySelected: Story = { args: { selectedKey: "d3" } };
