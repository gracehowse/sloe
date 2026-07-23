import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { WinMomentPlayer } from "./WinMomentPlayer";

const meta = {
  title: "Mobile/UI/WinMomentPlayer",
  component: WinMomentPlayer,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div
          style={{
            width: 360,
            padding: 16,
            background: "#F7F6FA",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 280,
          }}
        >
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Landmark celebration primitive — gold ring sweep + confetti for goal-hit, streak, and log-confirm moments. Runs once on mount (~700ms) then calls `onComplete`.",
      },
    },
  },
} satisfies Meta<typeof WinMomentPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GoalHit: Story = {
  args: { celebration: "goal-hit", size: 220 },
};

export const Streak: Story = {
  args: { celebration: "streak", milestone: 7, size: 220 },
};

export const LogConfirm: Story = {
  args: { celebration: "log-confirm", size: 180 },
};
