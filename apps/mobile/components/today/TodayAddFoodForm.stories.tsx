import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayAddFoodForm } from "./TodayAddFoodForm";

const meta = {
  title: "Mobile/Today/TodayAddFoodForm",
  component: TodayAddFoodForm,
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
    slots: ["Breakfast", "Lunch", "Dinner", "Snacks"],
    activeMealSlot: "Breakfast",
    onActiveMealSlotChange: noop,
    title: "",
    onTitleChange: noop,
    kcal: "",
    onKcalChange: noop,
    protein: "",
    onProteinChange: noop,
    carbs: "",
    onCarbsChange: noop,
    fat: "",
    onFatChange: noop,
    onSubmit: noop,
    onOpenSearch: noop,
    styles: {},
    borderColor: c.border,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
  },
} satisfies Meta<typeof TodayAddFoodForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyBreakfast: Story = {};
export const FilledLunch: Story = {
  args: { activeMealSlot: "Lunch", title: "Greek yogurt", kcal: "120", protein: "15", carbs: "8", fat: "2" },
};
