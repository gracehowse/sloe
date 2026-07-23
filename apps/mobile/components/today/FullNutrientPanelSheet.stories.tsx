import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { FullNutrientPanelSheet } from "./FullNutrientPanelSheet";

const meta = {
  title: "Mobile/Today/FullNutrientPanelSheet",
  component: FullNutrientPanelSheet,
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
  parameters: { layout: "fullscreen" },
  args: {
    visible: true,
    onClose: noop,
    microSum: { iron_mg: 12, vit_d_mcg: 8, sodium_mg: 1800 },
    fiberG: 18,
    proteinG: 90,
    totalCarbsG: 140,
    totalFatG: 50,
    colors: { text: c.text, textSecondary: c.textSecondary, textTertiary: c.textTertiary, border: c.border, card: c.card, inputBg: c.inputBg },
  },
} satisfies Meta<typeof FullNutrientPanelSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RichDay: Story = {};
export const SparseDay: Story = { args: { fiberG: 6, microSum: {} } };
