import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text } from "react-native";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { MealRowSwipeable } from "./MealRowSwipeable";

const meta = {
  title: "Mobile/Today/MealRowSwipeable",
  component: MealRowSwipeable,
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
  args: { mealId: "meal-1", onDeleteMeal: noop, children: <Text style={{ padding: 16 }}>Greek yogurt bowl</Text> },
} satisfies Meta<typeof MealRowSwipeable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongTitle: Story = {
  args: { children: <Text style={{ padding: 16 }}>Chicken rice bowl with extra vegetables</Text> },
};
