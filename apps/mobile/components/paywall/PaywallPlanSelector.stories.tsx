import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { PaywallPlanSelector } from "./PaywallPlanSelector";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Paywall/PaywallPlanSelector",
  component: PaywallPlanSelector,
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
  
} satisfies Meta<typeof PaywallPlanSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [plan, setPlan] = React.useState("yearly"); return <PaywallPlanSelector selected={plan} onSelect={setPlan} />; }
export const Yearly: Story = { render: () => <Harness /> };
export const Monthly: Story = { render: () => <PaywallPlanSelector selected="monthly" onSelect={() => undefined} /> };
