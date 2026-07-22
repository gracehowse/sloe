import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RecipeImportReviewBanner } from "./RecipeImportReviewBanner";

const meta = {
  title: "Mobile/Recipe/RecipeImportReviewBanner",
  component: RecipeImportReviewBanner,
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
  args: {
    sourceName: "Mob Kitchen",
    sourceUrl: "https://example.com/recipe",
    onVerify: () => undefined,
  },
} satisfies Meta<typeof RecipeImportReviewBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;

export const LongSource: Story = {
  args: { sourceName: "The Guardian — Feasting" },
};
