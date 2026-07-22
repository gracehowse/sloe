import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { WeighInReminderControl } from "./WeighInReminderControl";

const meta = {
  title: "Settings/WeighInReminderControl",
  component: WeighInReminderControl,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeighInReminderControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WideLayout: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 560, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};
