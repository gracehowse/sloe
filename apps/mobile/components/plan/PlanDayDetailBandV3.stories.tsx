import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanDayDetailBandV3 } from "./PlanDayDetailBandV3";

const meta = {
  title: "Mobile/Plan/PlanDayDetailBandV3",
  component: PlanDayDetailBandV3,
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
    dayLabel: "Wednesday 18 Jun",
    dayTotalKcal: 1600,
    targetKcal: 2000,
    plannedCount: 3,
    cookedCount: 1,
    macros: { protein: 90, carbs: 140, fat: 50 },
  },
} satisfies Meta<typeof PlanDayDetailBandV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrackDay: Story = {};

export const OverTarget: Story = {
  args: { dayTotalKcal: 2400, plannedCount: 0, cookedCount: 0 },
};
