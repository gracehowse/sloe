import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import { IconButtonFixture } from "../_fixtures/roleFixtures";
import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/IconButton",
    role: "IconButton",
  }),
  render: (args) => <IconButtonFixture {...args} />,
  args: {
    label: "More info",
    onPress: () => {},
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

export const Pressed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /more info/i });
    await userEvent.pointer({ keys: "[MouseLeft>]", target: button });
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DarkScheme: Story = {
  name: "Rest (dark)",
  parameters: { globals: { theme: "dark" } },
};
