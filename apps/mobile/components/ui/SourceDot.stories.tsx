import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { View } from "react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SourceDot } from "./SourceDot";

const meta = {
  title: "Mobile/UI/SourceDot",
  component: SourceDot,
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
          "Provenance dot (6/8/10 pt). AI source pairs the dot with a sparkle glyph.",
      },
    },
  },
} satisfies Meta<typeof SourceDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Usda: Story = {
  args: { source: "usda" },
};

export const Off: Story = {
  args: { source: "off" },
};

export const Ai: Story = {
  args: { source: "ai" },
};

export const AllSources: Story = {
  render: () => (
    <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
      <SourceDot source="usda" />
      <SourceDot source="off" />
      <SourceDot source="fatsecret" />
      <SourceDot source="manual" />
      <SourceDot source="ai" />
    </View>
  ),
};

export const Large: Story = {
  args: { source: "usda", size: 10 },
};
