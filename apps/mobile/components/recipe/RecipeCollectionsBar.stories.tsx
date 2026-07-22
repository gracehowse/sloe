import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeCollectionsBar } from "./RecipeCollectionsBar";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeCollectionsBar",
  component: RecipeCollectionsBar,
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
  args: { collections: [{"id":"c1","name":"Weeknight winners","sortOrder":0,"createdAt":"2026-01-01T00:00:00.000Z"}, {"id":"c2","name":"Meal prep","sortOrder":1,"createdAt":"2026-01-02T00:00:00.000Z"}], selectedCollectionId: null, onSelectCollection: () => undefined, onCreateCollection: async () => true },
} satisfies Meta<typeof RecipeCollectionsBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Selected: Story = { args: { selectedCollectionId: "c1" } };
