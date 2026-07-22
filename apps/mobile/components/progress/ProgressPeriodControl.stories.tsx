import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { ProgressPeriodControl } from "./ProgressPeriodControl";
const NOW = new Date("2026-06-21T12:00:00Z");
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/ProgressPeriodControl",
  component: ProgressPeriodControl,
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
  
} satisfies Meta<typeof ProgressPeriodControl>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [period, setPeriod] = React.useState({ type: "W", offset: 0 }); return <ProgressPeriodControl period={period} weekStart="monday" onChange={setPeriod} now={NOW} />; }
export const CurrentWeek: Story = { render: () => <Harness /> };
export const Month: Story = { render: () => <ProgressPeriodControl period={{ type: "M", offset: 0 }} weekStart="monday" onChange={() => undefined} now={NOW} /> };
