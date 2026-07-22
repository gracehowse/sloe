import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaywallTrajectoryChartView } from "./PaywallTrajectoryChart";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Paywall/PaywallTrajectoryChartView",
  component: PaywallTrajectoryChartView,
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
    latestWeightKg: 72.4,
    targetCalories: 1500,
    maintenanceTdeeKcal: 2200,
    goal: "lose",
    byDay: {
      "2026-07-01": [{ calories: 1500 }],
      "2026-07-02": [{ calories: 1480 }],
      "2026-07-03": [{ calories: 1520 }],
      "2026-07-04": [{ calories: 1490 }],
      "2026-07-05": [{ calories: 1510 }],
      "2026-07-06": [{ calories: 1505 }],
    },
  },
} satisfies Meta<typeof PaywallTrajectoryChartView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Projection = {} as Story;
export const CalmModeHidden: Story = { args: { calmMode: true } };
