import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Segmented, type SegmentedProps } from "./segmented";

function SegmentedDemo(props: Omit<SegmentedProps<"metric" | "imperial">, "onChange">) {
  const [value, setValue] = useState(props.value);
  return <Segmented {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "Suppr/Onboarding/Segmented",
  component: SegmentedDemo,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    ariaLabel: "Unit system",
    options: [
      { value: "metric", label: "Metric" },
      { value: "imperial", label: "Imperial" },
    ],
    value: "metric",
  },
} satisfies Meta<typeof SegmentedDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MetricSelected: Story = { args: {} };

export const ImperialSelected: Story = {
  args: { value: "imperial" },
};
