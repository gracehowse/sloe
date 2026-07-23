import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { TrialEndReminderDayPicker } from "./TrialEndReminderDayPicker";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Paywall/TrialEndReminderDayPicker",
  component: TrialEndReminderDayPicker,
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
  
} satisfies Meta<typeof TrialEndReminderDayPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() { const [day, setDay] = React.useState(2); return <TrialEndReminderDayPicker value={day} onChange={setDay} />; }
export const Default: Story = { render: () => <Harness /> };
export const Sunday: Story = { render: () => <TrialEndReminderDayPicker value={0} onChange={() => undefined} /> };
