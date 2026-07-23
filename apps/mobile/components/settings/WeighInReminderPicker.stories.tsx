import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { WeighInReminderPicker } from "./WeighInReminderPicker";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Settings/WeighInReminderPicker",
  component: WeighInReminderPicker,
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
  
} satisfies Meta<typeof WeighInReminderPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness() {
  const [day, setDay] = React.useState(1);
  const [time, setTime] = React.useState("08:00");
  return <WeighInReminderPicker enabled weekday={day} time={time} onToggle={() => undefined} onChangeDay={setDay} onChangeTime={setTime} />;
}
export const Default: Story = { render: () => <Harness /> };
export const Disabled: Story = { render: () => <WeighInReminderPicker enabled={false} weekday={null} time="08:00" onToggle={() => undefined} onChangeDay={() => undefined} onChangeTime={() => undefined} /> };
