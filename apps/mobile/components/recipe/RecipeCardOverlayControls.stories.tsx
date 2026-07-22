import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeCardOverlayControls } from "./RecipeCardOverlayControls";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeCardOverlayControls",
  component: RecipeCardOverlayControls,
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
  args: { recipeTitle: "Miso ginger salmon", isSaved: true, onToggleSave: () => undefined, showDraft: false, collectionsEnabled: true, collections: [{"id":"c1","name":"Weeknight winners","sortOrder":0,"createdAt":"2026-01-01T00:00:00.000Z"}], memberOf: ["c1"], onToggleCollection: () => undefined },
} satisfies Meta<typeof RecipeCardOverlayControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Saved = {} as Story;
export const Unsaved: Story = { args: { isSaved: false } };
