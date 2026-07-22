import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { BrandedSlider, type BrandedSliderProps } from "./branded-slider";

function BrandedSliderDemo(props: Omit<BrandedSliderProps, "onChange">) {
  const [value, setValue] = useState(props.value);
  return <BrandedSlider {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "Suppr/Onboarding/BrandedSlider",
  component: BrandedSliderDemo,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    min: 0.25,
    max: 1.5,
    step: 0.05,
    value: 0.5,
    ariaLabel: "Weekly pace",
    formatBubble: (v: number) => `${v.toFixed(2)} kg/week`,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrandedSliderDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };

export const NearMinimum: Story = {
  args: { value: 0.3 },
};

export const NearMaximum: Story = {
  args: { value: 1.35 },
};
