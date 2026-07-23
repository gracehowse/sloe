import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { View } from "react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TrustChip } from "./TrustChip";

const meta = {
  title: "Mobile/UI/TrustChip",
  component: TrustChip,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Provenance / trust pill — six variants (USDA, OFF adjusted, estimated, manual, gluten tiers). Distinct from ConfidenceChip and SearchResultConfidenceChip.",
      },
    },
  },
} satisfies Meta<typeof TrustChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Usda: Story = {
  args: { variant: "usda" },
};

export const Estimated: Story = {
  args: { variant: "estimated" },
};

export const Manual: Story = {
  args: { variant: "manual" },
};

export const AllVariants: Story = {
  render: () => (
    <View style={{ gap: 8, alignItems: "flex-start" }}>
      <TrustChip variant="usda" />
      <TrustChip variant="off-adjusted" />
      <TrustChip variant="estimated" />
      <TrustChip variant="manual" />
      <TrustChip variant="gluten-high-conf" />
      <TrustChip variant="gluten-uncertain" />
    </View>
  ),
};
