import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";

import { Spacing } from "@/constants/theme";

import { CountBadgeFixture } from "../_fixtures/roleFixtures";
import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/CountBadge",
    role: "CountBadge",
  }),
  render: (args) => (
    <View style={{ flexDirection: "row", gap: Spacing.md }}>
      <CountBadgeFixture {...args} />
    </View>
  ),
  args: { count: 3, active: false },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

export const ActiveTab: Story = {
  name: "Rest (active tab)",
  args: { count: 12, active: true },
};

export const Capped: Story = {
  name: "Rest (999+ cap)",
  args: { count: 1200, active: false },
};

export const DarkScheme: Story = {
  name: "Rest (dark)",
  parameters: { globals: { theme: "dark" } },
  args: { count: 5, active: true },
};
