import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayHeroRingGraphic } from "./TodayHeroRingGraphic";

const meta = {
  title: "Mobile/Today/TodayHeroRingGraphic",
  component: TodayHeroRingGraphic,
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
    consumed: 1240,
    goal: 2000,
    textColor: c.text,
    secondaryColor: c.textSecondary,
    trackColor: c.border,
    numeralLarge: false,
  },
} satisfies Meta<typeof TodayHeroRingGraphic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidDay: Story = {};
export const LargeNumeral: Story = { args: { consumed: 1980, numeralLarge: true } };
