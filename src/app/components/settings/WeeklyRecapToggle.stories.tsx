import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { WeeklyRecapToggle } from "./WeeklyRecapToggle";

function WeeklyRecapToggleDemo({
  enabled: initialEnabled,
  weekStartDay,
}: {
  enabled: boolean;
  weekStartDay: "monday" | "sunday";
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  return (
    <WeeklyRecapToggle
      enabled={enabled}
      setEnabled={setEnabled}
      weekStartDay={weekStartDay}
    />
  );
}

const meta = {
  title: "Settings/WeeklyRecapToggle",
  component: WeeklyRecapToggleDemo,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    enabled: true,
    weekStartDay: "monday" as const,
  },
} satisfies Meta<typeof WeeklyRecapToggleDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MondayWeekStart: Story = {};

export const SundayWeekStartOff: Story = {
  args: {
    enabled: false,
    weekStartDay: "sunday",
  },
};
