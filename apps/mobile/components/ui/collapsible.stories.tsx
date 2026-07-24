import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text } from "react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { Collapsible } from "./collapsible";

const meta = {
  title: "Mobile/UI/Collapsible",
  component: Collapsible,
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
          "Collapsible section — tap the heading to reveal nested content. Lightweight show/hide for settings-style lists.",
      },
    },
  },
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Micronutrients: Story = {
  render: () => (
    <Collapsible title="Micronutrients">
      <Text>Iron 8mg · Calcium 320mg · Fibre 12g</Text>
    </Collapsible>
  ),
};

export const LongBody: Story = {
  render: () => (
    <Collapsible title="About this recipe">
      <Text>
        Imported from a shared link. Nutrition is estimated from ingredient matches —
        verify any flagged rows before logging.
      </Text>
    </Collapsible>
  ),
};
