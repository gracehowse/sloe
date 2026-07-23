import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayDashboardMacroRings } from "./TodayDashboardMacroRings";

const meta = {
  title: "Mobile/Today/TodayDashboardMacroRings",
  component: TodayDashboardMacroRings,
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
    totals: { protein: 90, carbs: 140, fat: 50 },
    targets: { protein: 130, carbs: 195, fat: 62 },
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    onPressMacro: noop,
  },
} satisfies Meta<typeof TodayDashboardMacroRings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balanced: Story = {};
export const OverFat: Story = { args: { totals: { protein: 90, carbs: 140, fat: 80 } } };
