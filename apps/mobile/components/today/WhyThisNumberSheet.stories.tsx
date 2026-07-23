import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { WhyThisNumberSheet } from "./WhyThisNumberSheet";

const meta = {
  title: "Mobile/Today/WhyThisNumberSheet",
  component: WhyThisNumberSheet,
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
    visible: true,
    onClose: noop,
    targetCalories: 2000,
    maintenanceTdee: 2200,
    confidence: "high",
    goal: "lose",
    planPaceKgPerWeek: -0.25,
    loggingDays: 14,
    backgroundColor: c.background,
    cardColor: c.card,
    cardBorderColor: c.border,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    onPressAdjustTarget: noop,
  },
} satisfies Meta<typeof WhyThisNumberSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CutGoal: Story = {};
export const MaintenanceGoal: Story = { args: { goal: "maintain", planPaceKgPerWeek: 0 } };
