import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import MealTypePicker from "./MealTypePicker";

function Harness({ initial = ["breakfast"] as string[] }) {
  const [selected, setSelected] = React.useState(initial);
  return (
    <MealTypePicker selected={selected} onChange={setSelected} label="Meal types" />
  );
}

const meta = {
  title: "Mobile/Components/MealTypePicker",
  component: Harness,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSelected: Story = {};
export const MultiSelected: Story = { args: { initial: ["breakfast", "dinner"] } };
