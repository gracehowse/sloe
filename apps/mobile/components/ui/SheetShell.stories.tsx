import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { Type } from "@/constants/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import { SheetGrabberBar, SheetShell } from "./SheetShell";

const noop = () => undefined;

const meta = {
  title: "Mobile/UI/SheetShell",
  component: SheetShell,
  tags: ["autodocs", ...chromaticVisualContract.tags],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <SafeAreaProvider>
          <div style={{ width: 360, minHeight: 640, background: "#F7F6FA" }}>
            <Story />
          </div>
        </SafeAreaProvider>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    ...chromaticVisualContract.parameters,
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Bottom-sheet chassis — SHEET_RADIUS top corners, MODAL_OVERLAY_SCRIM backdrop, shared grabber (ENG-1662).",
      },
    },
  },
  args: {
    visible: true,
    onClose: noop,
  },
} satisfies Meta<typeof SheetShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: (args) => (
    <SheetShell {...args} testID="sheet-shell-open">
      <Text style={{ ...Type.headline, marginBottom: 8 }}>Adjust targets</Text>
      <Text style={Type.body}>
        Update today&apos;s calorie and macro goals before saving.
      </Text>
      <View style={{ marginTop: 24, gap: 12 }}>
        <SupprButton variant="primary" label="Save" onPress={noop} />
        <SupprButton label="Cancel" variant="ghost" onPress={args.onClose} />
      </View>
    </SheetShell>
  ),
};

export const NoScrimDismiss: Story = {
  args: { dismissOnScrimPress: false },
  render: (args) => (
    <SheetShell {...args} testID="sheet-shell-no-dismiss">
      <Text style={Type.headline}>Confirm reset</Text>
      <Text style={{ ...Type.body, marginTop: 8 }}>
        Scrim taps are disabled — use an explicit action to close.
      </Text>
    </SheetShell>
  ),
};

export const GrabberBar: Story = {
  render: () => (
    <View style={{ padding: 16, backgroundColor: "#fff", borderRadius: 24 }}>
      <SheetGrabberBar testID="sheet-grabber-preview" />
      <Text style={Type.body}>Grabber-only preview inside a sheet body.</Text>
    </View>
  ),
};
