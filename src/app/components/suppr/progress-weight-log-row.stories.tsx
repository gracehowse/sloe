import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { ProgressWeightLogRow } from "./progress-weight-log-row";

function WeightLogRowHarness({ isImperial }: { isImperial: boolean }) {
  const [value, setValue] = React.useState("");
  return (
    <ProgressWeightLogRow
      inputRef={null}
      value={value}
      onChange={setValue}
      isImperial={isImperial}
      onSave={() => undefined}
    />
  );
}

const meta = {
  title: "Suppr/ProgressWeightLogRow",
  component: WeightLogRowHarness,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Inline weight log row on the Progress weight card — input, ghost CTA, coaching copy.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeightLogRowHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Metric: Story = {
  args: { isImperial: false },
};

export const Imperial: Story = {
  args: { isImperial: true },
};
