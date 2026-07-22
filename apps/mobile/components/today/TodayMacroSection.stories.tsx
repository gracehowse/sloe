import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayMacroSection } from "./TodayMacroSection";

const meta = {
  title: "Mobile/Today/TodayMacroSection",
  component: TodayMacroSection,
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
    macroDisplayStyle: "tiles",
    trackedMacros: ["protein", "carbs", "fat", "fiber"],
    totals: { protein: 45, carbs: 120, fat: 38, fiber: 12 },
    targets: { protein: 130, carbs: 195, fat: 62, fiber: 41 },
    totalWaterMl: 800,
    waterGoalMl: 2000,
    mealsToday: [],
    onPressMacro: noop,
    cardColor: c.card,
    cardBorderColor: c.border,
    borderColor: c.border,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    mutedColor: c.muted,
  },
} satisfies Meta<typeof TodayMacroSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tiles: Story = {};
export const Rings: Story = { args: { macroDisplayStyle: "rings" } };
