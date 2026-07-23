import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { MobileSegmented } from "./segmented";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/segmented",
  component: MobileSegmented,
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
  
} satisfies Meta<typeof MobileSegmented>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [value, setValue] = React.useState("metric"); return <MobileSegmented options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]} value={value} onChange={setValue} />; }
export const Default: Story = { render: () => <Harness /> };
export const Imperial: Story = { render: () => <MobileSegmented options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]} value="imperial" onChange={() => undefined} /> };
