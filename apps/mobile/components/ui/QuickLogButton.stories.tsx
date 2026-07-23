import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { View } from "react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { QuickLogButton } from "./QuickLogButton";

const meta = {
  title: "Mobile/UI/QuickLogButton",
  component: QuickLogButton,
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
          "Compact secondary Log action on suggestion surfaces. Host owns the journal insert; this component owns async press state (disable + spinner).",
      },
    },
  },
} satisfies Meta<typeof QuickLogButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ghost: Story = {
  args: {
    appearance: "ghost",
    accessibilityLabel: "Log Chicken salad to Lunch",
    onLog: async () => undefined,
  },
};

export const OnImage: Story = {
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div
          style={{
            width: 360,
            padding: 16,
            background: "linear-gradient(135deg, #3B2A4D 0%, #6B4E71 100%)",
          }}
        >
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  render: (args) => (
    <View style={{ alignSelf: "flex-start" }}>
      <QuickLogButton {...args} />
    </View>
  ),
  args: {
    appearance: "onImage",
    accessibilityLabel: "Log North-star bowl to Lunch",
    onLog: async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    },
  },
};
