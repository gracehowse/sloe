import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeIngredientRows } from "./RecipeIngredientRows";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeIngredientRows",
  component: RecipeIngredientRows,
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
  args: { ingredients: [{ name: "Spaghetti", amount: 400, unit: "g", calories: 580, protein: 20, carbs: 112, fat: 2 }], forServings: 2, viewMultiplier: 1, onIngredientPress: () => undefined, onViewAll: () => undefined, expanded: true },
} satisfies Meta<typeof RecipeIngredientRows>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Collapsed: Story = { args: { expanded: false } };
