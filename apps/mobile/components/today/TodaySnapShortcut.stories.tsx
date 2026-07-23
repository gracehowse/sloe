import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodaySnapShortcut } from "./TodaySnapShortcut";

const meta = {
  title: "Mobile/Today/TodaySnapShortcut",
  component: TodaySnapShortcut,
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
  args: { locked: false, onPress: () => undefined },
} satisfies Meta<typeof TodaySnapShortcut>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProUnlocked: Story = {};
export const Locked: Story = { args: { locked: true } };
