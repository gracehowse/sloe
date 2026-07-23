import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayDashboardMacroBars } from "./TodayDashboardMacroBars";

const meta = {
  title: "Mobile/Today/TodayDashboardMacroBars",
  component: TodayDashboardMacroBars,
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
    trackedMacros: ["protein", "carbs", "fat"],
    totals: { protein: 90, carbs: 140, fat: 50, fiber: 18 },
    targets: { protein: 130, carbs: 195, fat: 62, fiber: 41 },
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    borderColor: c.border,
    onPressMacro: noop,
  },
} satisfies Meta<typeof TodayDashboardMacroBars>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrack: Story = {};
export const OverCarbs: Story = { args: { totals: { protein: 90, carbs: 220, fat: 50, fiber: 18 }, netCarbsLensEnabled: true } };
