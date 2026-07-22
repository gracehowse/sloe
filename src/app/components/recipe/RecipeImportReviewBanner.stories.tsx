import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeImportReviewBanner } from "./RecipeImportReviewBanner";

const meta = {
  title: "Suppr/Recipe/RecipeImportReviewBanner",
  component: RecipeImportReviewBanner,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    sourceName: "Instagram",
    sourceUrl: "https://www.instagram.com/reel/example",
    onVerify: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecipeImportReviewBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InstagramImport: Story = {};

export const BlogImport: Story = {
  args: {
    sourceName: "Recipe blog",
    sourceUrl: "https://example.com/chicken-congee",
  },
};
