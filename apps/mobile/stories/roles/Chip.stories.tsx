import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import { FilterChip } from "@/components/ui/FilterChip";

import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/Chip",
    component: FilterChip,
    role: "Chip",
  }),
  args: {
    label: "Breakfast",
    onPress: () => {},
  },
} satisfies Meta<typeof FilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {
  args: { selected: false },
};

export const Selected: Story = {
  name: "Rest (selected)",
  args: { selected: true },
};

export const Pressed: Story = {
  args: { selected: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole("button", { name: /breakfast/i });
    await userEvent.pointer({ keys: "[MouseLeft>]", target: chip });
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DarkScheme: Story = {
  name: "Rest (dark)",
  parameters: { globals: { theme: "dark" } },
  args: { selected: true },
};
