import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RecipeDetailLoadingSkeleton } from "./RecipeDetailLoadingSkeleton";

const meta = {
  title: "Mobile/Recipe/RecipeDetailLoadingSkeleton",
  component: RecipeDetailLoadingSkeleton,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecipeDetailLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;

export const WithInset: Story = {
  args: { topInset: 44 },
};
