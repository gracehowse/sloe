import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayWeeklyRollingCard } from "./TodayWeeklyRollingCard";

const meta = {
  title: "Mobile/Today/TodayWeeklyRollingCard",
  component: TodayWeeklyRollingCard,
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
    weekConsumed: 12500,
    weekEffectiveCalorieBudget: 14000,
    isWeekDeficit: true,
    projectedKgChange: -0.3,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    cardBackgroundColor: c.card,
    borderColor: c.border,
  },
} satisfies Meta<typeof TodayWeeklyRollingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deficit: Story = {};
export const Calibrating: Story = { args: { weekConsumed: 0, projectedKgChange: null } };
