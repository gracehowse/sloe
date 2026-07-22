import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TargetInput } from "./TargetInput";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/Steps/TargetInput",
  component: TargetInput,
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
  
} satisfies Meta<typeof TargetInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [value, setValue] = React.useState("1500"); return <TargetInput label="Calories" value={value} onChangeText={setValue} keyboardType="number-pad" />; }
export const Default: Story = { render: () => <Harness /> };
export const Protein: Story = { render: () => <TargetInput label="Protein (g)" value="120" onChangeText={() => undefined} keyboardType="number-pad" /> };
