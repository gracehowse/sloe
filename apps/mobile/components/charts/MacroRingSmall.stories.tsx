import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import MacroRingSmall from "./MacroRingSmall";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Charts/MacroRingSmall",
  component: MacroRingSmall,
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
  args: { value: 96, goal: 120, label: "Protein", color: "#3B2A4D", trackColor: "#E8E6EF", labelColor: "#6B6574" },
} satisfies Meta<typeof MacroRingSmall>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrack = {} as Story;
export const OverGoal: Story = { args: { value: 132, goal: 120 } };
