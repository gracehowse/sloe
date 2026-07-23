import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayPlannedMealsCard } from "./TodayPlannedMealsCard";

const meta = {
  title: "Mobile/Today/TodayPlannedMealsCard",
  component: TodayPlannedMealsCard,
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
    plannedMeals: [
      { slot: "Lunch", name: "Chicken traybake", kcal: 540 },
      { slot: "Dinner", name: "Spaghetti bolognese", kcal: 780 },
    ],
    onLogPlannedMeal: noop,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    cardBackgroundColor: c.card,
    borderColor: c.border,
  },
} satisfies Meta<typeof TodayPlannedMealsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoMeals: Story = {};
export const SingleMeal: Story = { args: { plannedMeals: [{ slot: "Dinner", name: "Salmon bowl", kcal: 620 }] } };
