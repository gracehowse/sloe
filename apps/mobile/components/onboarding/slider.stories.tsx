import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { MobileMiniSlider } from "./slider";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/slider",
  component: MobileMiniSlider,
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
  
} satisfies Meta<typeof MobileMiniSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [value, setValue] = React.useState(0.5); return <MobileMiniSlider value={value} onChange={setValue} min={0.25} max={1} step={0.25} />; }
export const Default: Story = { render: () => <Harness /> };
export const Slow: Story = { render: () => <MobileMiniSlider value={0.25} onChange={() => undefined} min={0.25} max={1} step={0.25} /> };
