import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { ProgressStoryGate } from "./ProgressStoryGate";

const meta = {
  title: "Mobile/Today/ProgressStoryGate",
  component: ProgressStoryGate,
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
  args: { daysLogged: 0, hasHistory: false },
} satisfies Meta<typeof ProgressStoryGate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ColdStart: Story = {};
export const ReturningUser: Story = { args: { daysLogged: 1, hasHistory: true } };
