import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayCompleteDayButton } from "./TodayCompleteDayButton";

const meta = {
  title: "Mobile/Today/TodayCompleteDayButton",
  component: TodayCompleteDayButton,
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
  args: { userId: "user-1", selectedDate: new Date("2026-06-21T12:00:00"), onComplete: () => undefined },
} satisfies Meta<typeof TodayCompleteDayButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {};
export const SignedOut: Story = { args: { userId: null } };
