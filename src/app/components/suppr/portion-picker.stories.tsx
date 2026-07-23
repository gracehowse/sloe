import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import {
  buildPickerOptions,
  type PortionState,
  type ProductInput,
} from "../../../lib/nutrition/portionPicker";
import { PortionPickerWeb } from "./portion-picker";

const PRODUCT: ProductInput = {
  servingOptions: [{ label: "1 meatball", grams: 22 }],
  servingSizeG: 88,
};

function PortionPickerHarness({
  product = PRODUCT,
  hideQuickChips,
  macrosPer100g,
  basisCorrected,
}: {
  product?: ProductInput;
  hideQuickChips?: boolean;
  macrosPer100g?: React.ComponentProps<typeof PortionPickerWeb>["macrosPer100g"];
  basisCorrected?: boolean;
}) {
  const options = buildPickerOptions(product);
  const [value, setValue] = React.useState<PortionState>(options.initial);
  return (
    <PortionPickerWeb
      product={product}
      value={value}
      onChange={setValue}
      options={options}
      hideQuickChips={hideQuickChips}
      macrosPer100g={macrosPer100g}
      basisCorrected={basisCorrected}
    />
  );
}

const meta = {
  title: "Suppr/PortionPicker",
  component: PortionPickerHarness,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Web portion picker — shared unit/chip model with mobile. Controlled harness for Storybook.",
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
} satisfies Meta<typeof PortionPickerHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Count product + quick chips",
};

export const GramsOnly: Story = {
  name: "Grams only (chips hidden)",
  args: {
    product: { servingSizeG: 100 },
    hideQuickChips: true,
  },
};

export const PlausibilityWarning: Story = {
  name: "Scale plausibility warning",
  args: {
    macrosPer100g: {
      calories: 250,
      protein: 12,
      carbs: 30,
      fat: 8,
    },
    basisCorrected: true,
  },
};
