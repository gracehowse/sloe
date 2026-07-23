import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NamedTrackerReassuranceStrip } from "./NamedTrackerReassuranceStrip";

const meta = {
  title: "Suppr/Imports/NamedTrackerReassuranceStrip",
  component: NamedTrackerReassuranceStrip,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NamedTrackerReassuranceStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomTestId: Story = {
  args: { testID: "csv-tracker-strip" },
};
