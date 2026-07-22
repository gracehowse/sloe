import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FilterChip } from "./filter-chip";

const meta = {
  component: FilterChip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Anatomy role **Chip** — rounded-full filter/option chip. Quiet card fill at rest; selected = primary-soft + primary-solid label. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof FilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "High protein",
    selected: false,
  },
};

export const Selected: Story = {
  args: {
    label: "High protein",
    selected: true,
  },
};

export const Disabled: Story = {
  args: {
    label: "High protein",
    selected: false,
    disabled: true,
  },
};
