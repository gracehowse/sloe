import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TrialEndReminderDayPicker } from "./TrialEndReminderDayPicker";
import {
  DEFAULT_TRIAL_END_REMINDER_DAY,
  type TrialEndReminderDay,
} from "@/lib/push/trialEndReminder";

function TrialEndReminderDayPickerDemo(
  props: Omit<ComponentProps<typeof TrialEndReminderDayPicker>, "value" | "onChange"> & {
    initialValue?: TrialEndReminderDay;
  },
) {
  const [value, setValue] = useState(props.initialValue ?? DEFAULT_TRIAL_END_REMINDER_DAY);
  return <TrialEndReminderDayPicker {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "Suppr/Paywall/TrialEndReminderDayPicker",
  component: TrialEndReminderDayPickerDemo,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    visible: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrialEndReminderDayPickerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {};

export const Hidden: Story = {
  args: { visible: false },
};
