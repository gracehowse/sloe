import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_SHEET_COLORS } from "./_mobileStoryDecorators";
import { RecipeNotesCard } from "./RecipeNotesCard";

const meta = {
  title: "Mobile/Components/RecipeNotesCard",
  component: RecipeNotesCard,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecipeNotesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  args: { recipeId: "demo-recipe", userId: null, colors: MOCK_SHEET_COLORS },
};

export const LoadingState: Story = {
  args: { recipeId: "demo-recipe", userId: "story-user", colors: MOCK_SHEET_COLORS },
};
