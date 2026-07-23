import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayFastingPill } from "./TodayFastingPill";

const meta = {
  title: "Mobile/Today/TodayFastingPill",
  component: TodayFastingPill,
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
  args: { mode: "active", startedAt: new Date(Date.now() - 7200000).toISOString(), nowTick: Date.now(), onPress: () => undefined },
} satisfies Meta<typeof TodayFastingPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};
export const Idle: Story = { args: { mode: "idle" } };
