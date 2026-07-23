import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { MobileNumberStepper } from "./number-stepper";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/number-stepper",
  component: MobileNumberStepper,
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
  
} satisfies Meta<typeof MobileNumberStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [value, setValue] = React.useState(32); return <MobileNumberStepper value={value} onChange={setValue} min={16} max={99} suffix="years" />; }
export const Default: Story = { render: () => <Harness /> };
export const AtMin: Story = { render: () => <MobileNumberStepper value={16} onChange={() => undefined} min={16} max={99} suffix="years" /> };
