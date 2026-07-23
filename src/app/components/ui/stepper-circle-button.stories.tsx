import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Minus, Plus } from "lucide-react";
import { StepperCircleButton } from "./stepper-circle-button";

const meta = {
  component: StepperCircleButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "± circle for numeric steppers — tokenised sm/md/lg diameters (ENG-1662). Used by ServingStepper, NumberStepper, and PortionStepper.",
      },
    },
  },
  args: {
    "aria-label": "Decrease",
    children: <Minus aria-hidden width={16} height={16} />,
  },
} satisfies Meta<typeof StepperCircleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

export const SmallBordered: Story = {
  args: {
    size: "sm",
    bordered: true,
    "aria-label": "Increase",
    children: <Plus aria-hidden width={14} height={14} />,
  },
};

export const LargeDisabled: Story = {
  args: {
    size: "lg",
    disabled: true,
    "aria-label": "Decrease",
    children: <Minus aria-hidden width={18} height={18} />,
  },
};
