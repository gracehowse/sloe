import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import RecipeEditSheet from "./RecipeEditSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeEditSheet",
  component: RecipeEditSheet,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={ { width: 360, padding: 16, background: "#F7F6FA" } }>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: { visible: true, onClose: () => undefined, onSave: () => undefined, recipe: { id: "r1", title: "Greek salad bowl", description: null, instructions: null, servings: 2, prep_time_min: 10, cook_time_min: 20, meal_type: null, author_id: null }, ingredients: [{ rowId: "1", localKey: "1", name: "Cucumber", amount: "1", unit: "whole" }] },
} satisfies Meta<typeof RecipeEditSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const Hidden: Story = { args: { visible: false } };
