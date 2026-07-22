import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import MaintenanceExplainer from "./MaintenanceExplainer";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/MaintenanceExplainer",
  component: MaintenanceExplainer,
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
  
} satisfies Meta<typeof MaintenanceExplainer>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness(props) { const [open, setOpen] = React.useState(false); return <MaintenanceExplainer {...props} open={open} onToggle={() => setOpen(v => !v)} />; }
const base = { sex: "female", weightKg: 62, heightCm: 165, age: 34, activityLevel: "moderate", resolved: { kcal: 2073, source: "adaptive", confidence: "high" }, planPace: "steady", userGoal: "lose", goalCalories: 1500 };
export const Collapsed: Story = { render: () => <Harness {...base} /> };
export const Expanded: Story = { render: () => { const [open, setOpen] = React.useState(true); return <MaintenanceExplainer {...base} open={open} onToggle={() => setOpen(v => !v)} />; } };
