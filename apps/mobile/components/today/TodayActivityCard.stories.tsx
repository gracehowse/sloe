import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayActivityCard } from "./TodayActivityCard";

const meta = {
  title: "Mobile/Today/TodayActivityCard",
  component: TodayActivityCard,
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
    stepsCount: 8420,
    stepsGoal: 10000,
    burnKcal: 420,
    burnGoal: 500,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    cardBackgroundColor: c.card,
    borderColor: c.border,
    onShowProvenance: noop,
  },
} satisfies Meta<typeof TodayActivityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSteps: Story = {};
export const NoSteps: Story = { args: { stepsCount: null } };
