import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import {
  RulerSlider,
  formatImperialHeightInches,
  parseImperialHeightInches,
} from "./ruler-slider";

function RulerHarness({
  min,
  max,
  step,
  unit,
  initial,
}: {
  min: number;
  max: number;
  step?: number;
  unit?: string;
  initial: number;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <RulerSlider
      value={value}
      onChange={setValue}
      min={min}
      max={max}
      step={step}
      unit={unit}
      ariaLabel="Value"
    />
  );
}

const meta = {
  title: "Suppr/RulerSlider",
  component: RulerHarness,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "iOS-style horizontal ruler picker — drag, wheel, keyboard, tap-to-edit.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RulerHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WeightKg: Story = {
  name: "Weight (kg)",
  args: { min: 40, max: 160, step: 0.1, unit: "kg", initial: 72.4 },
};

function ImperialHeightHarness() {
  const [value, setValue] = React.useState(70);
  return (
    <RulerSlider
      value={value}
      onChange={setValue}
      min={48}
      max={84}
      step={1}
      format={formatImperialHeightInches}
      parseInput={parseImperialHeightInches}
      ariaLabel="Height"
    />
  );
}

export const ImperialHeight: StoryObj = {
  name: "Imperial height",
  render: () => <ImperialHeightHarness />,
};
