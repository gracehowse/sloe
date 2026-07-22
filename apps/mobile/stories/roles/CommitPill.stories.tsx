import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import { SupprButton } from "@/components/ui/SupprButton";

import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/CommitPill",
    component: SupprButton,
    role: "CommitPill",
  }),
  args: {
    variant: "primary" as const,
    label: "Log meal",
    onPress: () => {},
  },
} satisfies Meta<typeof SupprButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

export const Pressed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /log meal/i });
    await userEvent.pointer({ keys: "[MouseLeft>]", target: button });
  },
};

export const Disabled: Story = {
  args: { disabled: true, label: "Log meal" },
};

export const Loading: Story = {
  args: { loading: true, label: "Logging…" },
};

export const DarkScheme: Story = {
  name: "Rest (dark)",
  parameters: { globals: { theme: "dark" } },
};
