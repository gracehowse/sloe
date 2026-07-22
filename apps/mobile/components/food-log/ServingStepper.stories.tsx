import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ServingStepper } from "./ServingStepper";

function Harness({ step = 1, unit = "serving" as const }) {
  const [value, setValue] = React.useState("1");
  return (
    <ServingStepper
      value={value}
      onChange={setValue}
      step={step}
      unit={unit}
      testIdPrefix="story-serving"
    />
  );
}

const meta = {
  title: "Mobile/FoodLog/ServingStepper",
  component: Harness,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Servings: Story = {};
export const Grams: Story = { args: { step: 5, unit: "g" } };
