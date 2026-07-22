import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { Text } from "react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RootErrorBoundary } from "./RootErrorBoundary";

function ThrowOnRender(): React.ReactNode {
  throw new Error("Storybook demo render error");
}

const meta = {
  title: "Mobile/UI/RootErrorBoundary",
  component: RootErrorBoundary,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, height: 480, background: "#F7F6FA" }}>
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
          "Root-level error boundary — branded recovery UI (Try again) when an uncaught render error escapes the tree. Sits above the theme provider in production.",
      },
    },
  },
} satisfies Meta<typeof RootErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HealthyChild: Story = {
  render: () => (
    <RootErrorBoundary>
      <Text>App content renders normally.</Text>
    </RootErrorBoundary>
  ),
};

export const RecoveryUi: Story = {
  render: () => (
    <RootErrorBoundary>
      <ThrowOnRender />
    </RootErrorBoundary>
  ),
};
