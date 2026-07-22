import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookRunningTimerStrip } from "./CookRunningTimerStrip";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookRunningTimerStrip",
  component: CookRunningTimerStrip,
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
  args: { timers: [{ id: "t1", label: "Simmer", remainingSec: 245, done: false }], onReset: () => undefined, onCancel: () => undefined },
} satisfies Meta<typeof CookRunningTimerStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running = {} as Story;
export const Done: Story = { args: { timers: [{ id: "t1", label: "Simmer", remainingSec: 0, done: true }] } };
