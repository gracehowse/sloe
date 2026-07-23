import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeLogPortionSheet } from "./RecipeLogPortionSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeLogPortionSheet",
  component: RecipeLogPortionSheet,
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
  args: { visible: true, onClose: () => undefined, recipeTitle: "Chicken rice bowl", baseServings: 2, perServing: { calories: 540, protein: 42, carbs: 58, fat: 14 }, yieldDef: { kind: "servings" }, onConfirm: () => undefined },
} satisfies Meta<typeof RecipeLogPortionSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const Logging: Story = { args: { logging: true } };
