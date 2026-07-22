import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayFreshDayLogPill } from "./TodayFreshDayLogPill";

const meta = {
  title: "Mobile/Today/TodayFreshDayLogPill",
  component: TodayFreshDayLogPill,
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
  args: { onPress: () => undefined },
} satisfies Meta<typeof TodayFreshDayLogPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Morning: Story = { args: { hour: 8 } };
export const Evening: Story = { args: { hour: 19 } };
