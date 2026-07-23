import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayNutrientsModal } from "./TodayNutrientsModal";

const meta = {
  title: "Mobile/Today/TodayNutrientsModal",
  component: TodayNutrientsModal,
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
    rows: [
      { key: "fiber", label: "Fiber", value: "18 g" },
      { key: "sugar", label: "Sugar", value: "42 g" },
      { key: "sodium", label: "Sodium", value: "1800 mg" },
    ],
    backgroundColor: c.background,
    cardColor: c.card,
    cardBorderColor: c.border,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
  },
} satisfies Meta<typeof TodayNutrientsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Closed: Story = { args: { visible: false } };
