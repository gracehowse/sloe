import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import { AddRowButton } from "@/components/ui/AddRowButton";

import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/AddRow",
    component: AddRowButton,
    role: "AddRow",
  }),
  args: {
    label: "Add food",
    onPress: () => {},
  },
} satisfies Meta<typeof AddRowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

export const Pressed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole("button", { name: /add food/i });
    await userEvent.pointer({ keys: "[MouseLeft>]", target: row });
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Loading: Story = {
  args: { loading: true },
};

export const DarkScheme: Story = {
  name: "Rest (dark)",
  parameters: { globals: { theme: "dark" } },
};
