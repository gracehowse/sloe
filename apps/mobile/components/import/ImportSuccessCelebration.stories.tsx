import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text, View } from "react-native";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ImportSuccessCelebration } from "./ImportSuccessCelebration";

const meta = {
  title: "Mobile/Import/ImportSuccessCelebration",
  component: ImportSuccessCelebration,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ImportSuccessCelebration>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPanel: Story = {
  render: () => (
    <ImportSuccessCelebration testID="import-success-celebration">
      <View style={{ padding: 24, borderRadius: 24, backgroundColor: "#fff" }}>
        <Text style={{ fontWeight: "600" }}>Recipe imported</Text>
        <Text>Review ingredients before saving.</Text>
      </View>
    </ImportSuccessCelebration>
  ),
};

export const ReducedMotionSafe: Story = {
  render: () => (
    <ImportSuccessCelebration>
      <View style={{ padding: 24, backgroundColor: "#fff", borderRadius: 24 }}>
        <Text>Success panel (static)</Text>
      </View>
    </ImportSuccessCelebration>
  ),
};
