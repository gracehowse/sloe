import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookIngredientChecklist } from "./CookIngredientChecklist";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookIngredientChecklist",
  component: CookIngredientChecklist,
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
  args: { recipeId: "story-recipe-1", surface: "mise" as const, items: [{ name: "Spaghetti", amountLabel: "400 g" }] },
} satisfies Meta<typeof CookIngredientChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MiseSurface = {} as Story;
export const CookSurface: Story = { args: { surface: "cook" } };
