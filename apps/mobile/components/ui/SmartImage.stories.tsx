import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { View } from "react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SmartImage } from "./SmartImage";

const meta = {
  title: "Mobile/UI/SmartImage",
  component: SmartImage,
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
          "Flag-gated remote-image wrapper (`expo_image_adoption_v1`) with cross-fade + cache; falls back to RN Image when the flag is off.",
      },
    },
  },
} satisfies Meta<typeof SmartImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecipeThumb: Story = {
  render: (args) => (
    <View style={{ width: 160, height: 120, borderRadius: 12, overflow: "hidden" }}>
      <SmartImage {...args} style={{ width: "100%", height: "100%" }} />
    </View>
  ),
  args: {
    source: { uri: "https://picsum.photos/seed/suppr-recipe/320/240" },
    accessibilityLabel: "Recipe photo",
    placeholderColor: "#E5E4EA",
  },
};

export const Contain: Story = {
  render: (args) => (
    <View
      style={{
        width: 200,
        height: 120,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#E5E4EA",
      }}
    >
      <SmartImage {...args} style={{ width: "100%", height: "100%" }} />
    </View>
  ),
  args: {
    source: { uri: "https://picsum.photos/seed/suppr-contain/400/400" },
    resizeMode: "contain",
    accessibilityLabel: "Ingredient photo",
  },
};
