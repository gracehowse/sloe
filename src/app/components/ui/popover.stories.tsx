import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";

const meta = {
  component: Popover,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Click-anchored floating panel for filters, pickers, and short forms that should stay next to their trigger.",
      },
    },
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Filters</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm font-medium">Meal filters</p>
        <p className="mt-1 text-sm text-muted-foreground">High protein · Under 500 kcal</p>
      </PopoverContent>
    </Popover>
  ),
};

export const Open: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Filters</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm font-medium">Meal filters</p>
        <p className="mt-1 text-sm text-muted-foreground">High protein · Under 500 kcal</p>
      </PopoverContent>
    </Popover>
  ),
};
