import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { PortionPicker } from "./PortionPicker";
import {
  buildPickerOptions,
  type PortionState,
  type ProductInput,
} from "@suppr/nutrition-core/portionPicker";

const PRODUCT: ProductInput = {
  servingOptions: [{ label: "1 meatball", grams: 22 }],
  servingSizeG: 88,
};

function Harness({
  product = PRODUCT,
  hideQuickChips,
}: {
  product?: ProductInput;
  hideQuickChips?: boolean;
}) {
  const options = buildPickerOptions(product);
  const [value, setValue] = React.useState<PortionState>(options.initial);
  return (
    <PortionPicker
      product={product}
      value={value}
      onChange={setValue}
      options={options}
      hideQuickChips={hideQuickChips}
    />
  );
}

const meta = {
  title: "Mobile/Components/PortionPicker",
  component: Harness,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const GramsOnly: Story = { args: { product: { servingSizeG: 100 }, hideQuickChips: true } };
