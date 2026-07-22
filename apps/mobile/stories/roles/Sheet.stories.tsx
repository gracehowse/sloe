import type { Meta, StoryObj } from "@storybook/react";

import { SheetChromeFixture } from "../_fixtures/roleFixtures";
import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/Sheet",
    role: "Sheet",
  }),
  render: () => <SheetChromeFixture title="Log meal" />,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

export const DarkScheme: Story = {
  name: "Rest (dark)",
  parameters: { globals: { theme: "dark" } },
};
