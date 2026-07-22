import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeServingsFooter } from "./RecipeServingsFooter";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeServingsFooter",
  component: RecipeServingsFooter,
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
  args: { servings: 2, canDecrease: true, canIncrease: true, onDecrease: () => undefined, onIncrease: () => undefined, onCookMode: () => undefined, bottomInset: 24 },
} satisfies Meta<typeof RecipeServingsFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const AtMin: Story = { args: { servings: 1, canDecrease: false } };
