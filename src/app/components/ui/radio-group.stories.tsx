import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta = {
  component: RadioGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Single-choice radio set (Radix Radio Group). Pair each item with a Label for accessible hit targets.",
      },
    },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="lunch" className="max-w-xs">
      <div className="flex items-center gap-3">
        <RadioGroupItem value="breakfast" id="rg-breakfast" />
        <Label htmlFor="rg-breakfast">Breakfast</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="lunch" id="rg-lunch" />
        <Label htmlFor="rg-lunch">Lunch</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="dinner" id="rg-dinner" />
        <Label htmlFor="rg-dinner">Dinner</Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="lunch" disabled className="max-w-xs">
      <div className="flex items-center gap-3">
        <RadioGroupItem value="breakfast" id="rg-d-breakfast" />
        <Label htmlFor="rg-d-breakfast">Breakfast</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="lunch" id="rg-d-lunch" />
        <Label htmlFor="rg-d-lunch">Lunch</Label>
      </div>
    </RadioGroup>
  ),
};
