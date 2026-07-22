import type { Meta, StoryObj } from "@storybook/react";
import { Text } from "react-native";

import { SupprCard } from "@/components/ui/SupprCard";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

function InsetDemo() {
  const colors = useThemeColors();
  return (
    <SupprCard size="card">
      <Text style={{ ...Type.body, color: colors.text, marginBottom: Spacing.sm }}>
        Parent card surface
      </Text>
      <SupprCard size="inset" padding="md">
        <Text style={{ ...Type.caption, color: colors.textSecondary }}>
          Inset sub-panel — radius 12, hairline border, no shadow.
        </Text>
      </SupprCard>
    </SupprCard>
  );
}

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/InsetPanel",
    component: SupprCard,
    role: "InsetPanel",
  }),
  render: () => <InsetDemo />,
} satisfies Meta<typeof SupprCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

export const WarningInset: Story = {
  name: "Rest (warning tone)",
  render: () => (
    <SupprCard size="card" tone="warning">
      <SupprCard size="inset" padding="md">
        <Text style={{ ...Type.caption, color: "#8A5A14" }}>
          Nested inset on a tinted parent card.
        </Text>
      </SupprCard>
    </SupprCard>
  ),
};
