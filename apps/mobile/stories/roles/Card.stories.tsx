import type { Meta, StoryObj } from "@storybook/react";
import { Text } from "react-native";

import { SupprCard } from "@/components/ui/SupprCard";
import { Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

function CardBody() {
  const colors = useThemeColors();
  return (
    <Text style={{ ...Type.body, color: colors.text }}>
      Resting page-ground card — flat + hairline, radius 24.
    </Text>
  );
}

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/Card",
    component: SupprCard,
    role: "Card",
  }),
  render: (args) => (
    <SupprCard {...args}>
      <CardBody />
    </SupprCard>
  ),
} satisfies Meta<typeof SupprCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {
  args: { size: "card", tone: "neutral" },
};

export const PrimaryTone: Story = {
  name: "Rest (primary tone)",
  args: { size: "card", tone: "primary" },
};

export const SoftLift: Story = {
  name: "Rest (soft lift)",
  args: { size: "card", tone: "neutral", lift: "soft" },
};
