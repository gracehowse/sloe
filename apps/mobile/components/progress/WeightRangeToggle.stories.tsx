import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { WeightRangeToggle } from "./WeightRangeToggle";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/WeightRangeToggle",
  component: WeightRangeToggle,
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
  
} satisfies Meta<typeof WeightRangeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [value, setValue] = React.useState("1m"); return <WeightRangeToggle value={value} onChange={setValue} />; }
export const Default: Story = { render: () => <Harness /> };
export const Year: Story = { render: () => <WeightRangeToggle value="1y" onChange={() => undefined} /> };
