import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text } from "react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PressableScale } from "./PressableScale";

const meta = {
  title: "Mobile/UI/PressableScale",
  component: PressableScale,
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
          "§1.1 press micro-interaction primitive — scale 1→0.97 + haptic on press-in, spring release. Wraps every tappable control that needs consistent feedback.",
      },
    },
  },
} satisfies Meta<typeof PressableScale>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    accessibilityRole: "button",
    accessibilityLabel: "Press me",
    onPress: () => undefined,
    children: <Text>Press me</Text>,
  },
};

export const ConfirmHaptic: Story = {
  args: {
    haptic: "confirm",
    accessibilityRole: "button",
    accessibilityLabel: "Confirm",
    onPress: () => undefined,
    children: <Text>Confirm</Text>,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    accessibilityRole: "button",
    accessibilityLabel: "Saving",
    children: <Text>Saving…</Text>,
  },
};
