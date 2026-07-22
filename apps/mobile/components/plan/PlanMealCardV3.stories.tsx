import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanMealCardV3 } from "./PlanMealCardV3";

const meta = {
  title: "Mobile/Plan/PlanMealCardV3",
  component: PlanMealCardV3,
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
  args: { slot: "Dinner", name: "Spaghetti bolognese", kcal: 780, onPress: () => undefined },
} satisfies Meta<typeof PlanMealCardV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlannedMeal: Story = {};
export const CookedLocked: Story = { args: { isCooked: true, isLocked: true, note: "batch" } };
