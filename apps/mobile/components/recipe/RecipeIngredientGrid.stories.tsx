import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeIngredientGrid } from "./RecipeIngredientGrid";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeIngredientGrid",
  component: RecipeIngredientGrid,
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
  args: { recipeId: "r1", ingredients: [{ name: "Spaghetti", amount: 400, unit: "g", calories: 580, protein: 20, carbs: 112, fat: 2 }, { name: "Eggs", amount: 4, unit: null, calories: 280, protein: 24, carbs: 2, fat: 20 }], forServings: 2, viewMultiplier: 1, onIngredientPress: () => undefined, onViewAll: () => undefined, expanded: false },
} satisfies Meta<typeof RecipeIngredientGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed = {} as Story;
export const Expanded: Story = { args: { expanded: true } };
