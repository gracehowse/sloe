import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { GoalPaceSlider } from "./GoalPaceSlider";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recap/GoalPaceSlider",
  component: GoalPaceSlider,
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
  
} satisfies Meta<typeof GoalPaceSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [pace, setPace] = React.useState(0.5); return <GoalPaceSlider value={pace} onChange={setPace} min={0.25} max={1} />; }
export const Default: Story = { render: () => <Harness /> };
export const Slow: Story = { render: () => <GoalPaceSlider value={0.25} onChange={() => undefined} min={0.25} max={1} /> };
