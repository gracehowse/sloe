import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { Accent } from "@/constants/theme";
import { SupprRadio } from "./SupprRadio";

const meta = {
  title: "Mobile/UI/SupprRadio",
  component: SupprRadio,
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
          "Circular radio indicator — presentational only; parent row owns accessibilityRole=\"radio\" (ENG-1662).",
      },
    },
  },
} satisfies Meta<typeof SupprRadio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  args: { checked: false, testID: "suppr-radio-off" },
};

export const Checked: Story = {
  args: { checked: true, testID: "suppr-radio-on" },
};

export const CustomAccent: Story = {
  args: {
    checked: true,
    accentColor: Accent.success,
    testID: "suppr-radio-accent",
  },
};
