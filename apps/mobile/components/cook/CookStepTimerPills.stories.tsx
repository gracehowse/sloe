import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Animated } from "react-native";
import { CookStepTimerPills } from "./CookStepTimerPills";
const pulseRef = new Animated.Value(1);
const sampleTimers = [{ label: "10 min", seconds: 600, sourceText: "10 minutes" }];
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookStepTimerPills",
  component: CookStepTimerPills,
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
  args: { timers: sampleTimers, pulseFirst: false, pulseRef, onStart: () => undefined },
} satisfies Meta<typeof CookStepTimerPills>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTimer = {} as Story;
export const PulseFirst: Story = { args: { pulseFirst: true } };
