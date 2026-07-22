import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RulerSlider } from "./RulerSlider";

function Harness(props: Omit<React.ComponentProps<typeof RulerSlider>, "value" | "onChange">) {
  const [value, setValue] = React.useState(170);
  return (
    <MobileStoryThemeProvider>
      <GestureHandlerRootView style={{ width: 360, padding: 16, backgroundColor: "#F7F6FA" }}>
        <RulerSlider {...props} value={value} onChange={setValue} width={328} />
      </GestureHandlerRootView>
    </MobileStoryThemeProvider>
  );
}

const meta = {
  title: "Mobile/Components/RulerSlider",
  component: Harness,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeightCm: Story = {
  args: { min: 140, max: 210, step: 1, unit: "cm", accessibilityLabel: "Height" },
};

export const WeightKg: Story = {
  args: { min: 40, max: 160, step: 0.1, decimals: 1, unit: "kg", accessibilityLabel: "Weight" },
};
