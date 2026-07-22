import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import type { JournalMeal } from "@/lib/nutritionJournal";
const editingMeal: JournalMeal = {
  id: "m1", title: "Chicken rice bowl", calories: 540, protein: 42, carbs: 58, fat: 14, mealSlot: "Lunch", dateKey: "2026-06-21",
} as JournalMeal;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayEditMealModal } from "./TodayEditMealModal";

const meta = {
  title: "Mobile/Today/TodayEditMealModal",
  component: TodayEditMealModal,
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
    enabled: false,
    editingMeal,
    slots: ["Breakfast", "Lunch", "Dinner", "Snacks"],
    editSlot: "Lunch",
    onEditSlotChange: noop,
    editEatenAtEnabled: false,
    editEatenAtTime: "12:30",
    onEditEatenAtTimeChange: noop,
    title: "Chicken rice bowl",
    onTitleChange: noop,
    kcal: "540",
    onKcalChange: noop,
    protein: "42",
    onProteinChange: noop,
    carbs: "58",
    onCarbsChange: noop,
    fat: "14",
    onFatChange: noop,
    portion: 1,
    onPortionChange: noop,
    onSave: noop,
    onDelete: noop,
    onClose: noop,
    onCopySlot: noop,
    onShuffleSlot: noop,
    borderColor: c.border,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    cardColor: c.card,
  },
} satisfies Meta<typeof TodayEditMealModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LegacyDisabled: Story = {};
export const V2Enabled: Story = { args: { enabled: true } };
