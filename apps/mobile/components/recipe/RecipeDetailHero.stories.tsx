import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeDetailHero } from "./RecipeDetailHero";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeDetailHero",
  component: RecipeDetailHero,
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
  args: { recipeId: "story-recipe-1", title: "Weeknight carbonara", tags: ["Pasta"], imageUrl: null, imageBroken: false, onImageError: () => undefined, topInset: 44, saved: true, onBack: () => undefined, onToggleSave: () => undefined, onShare: () => undefined, overlay: {
      kicker: "Fits your day",
      title: "Weeknight carbonara",
      timeMin: 30,
      kcal: 520,
      servings: 2,
    } },
} satisfies Meta<typeof RecipeDetailHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlaceholderHero = {} as Story;
export const Unsaved: Story = { args: { saved: false } };
