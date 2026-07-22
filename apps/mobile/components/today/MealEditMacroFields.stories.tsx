import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { MealEditMacroFields } from "./MealEditMacroFields";

const meta = {
  title: "Mobile/Today/MealEditMacroFields",
  component: MealEditMacroFields,
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
    kcal: "540",
    protein: "42",
    carbs: "58",
    fat: "14",
    onChangeKcal: noop,
    onChangeProtein: noop,
    onChangeCarbs: noop,
    onChangeFat: noop,
    fieldBackgroundColor: c.inputBg,
    fieldBorderColor: c.border,
    textColor: c.text,
    placeholderColor: c.textTertiary,
  },
} satisfies Meta<typeof MealEditMacroFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {};
export const Empty: Story = { args: { kcal: "", protein: "", carbs: "", fat: "" } };
