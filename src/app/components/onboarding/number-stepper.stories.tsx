import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { NumberStepper, type NumberStepperProps } from "./number-stepper";

function NumberStepperDemo(props: Omit<NumberStepperProps, "onChange">) {
  const [value, setValue] = useState(props.value);
  return <NumberStepper {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "Suppr/Onboarding/NumberStepper",
  component: NumberStepperDemo,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    value: 28,
    min: 14,
    max: 100,
    suffix: "years",
    ariaLabel: "Age",
  },
} satisfies Meta<typeof NumberStepperDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };

export const HeroAgeStep: Story = {
  args: {
    big: true,
    value: 32,
  },
};

export const AtMinimum: Story = {
  args: {
    big: true,
    value: 14,
  },
};
