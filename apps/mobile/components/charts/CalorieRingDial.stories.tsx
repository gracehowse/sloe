import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CalorieRingDial } from "./CalorieRingDial";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Charts/CalorieRingDial",
  component: CalorieRingDial,
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
  args: { consumed: 820, target: 1500 },
} satisfies Meta<typeof CalorieRingDial>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderTarget = {} as Story;
export const OverTarget: Story = { args: { consumed: 1680, target: 1500 } };
