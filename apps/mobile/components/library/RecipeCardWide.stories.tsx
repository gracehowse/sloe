import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_RECIPE } from "../_mobileStoryDecorators";
import { RecipeCardWide } from "./RecipeCardWide";

const meta = {
  title: "Mobile/Library/RecipeCardWide",
  component: RecipeCardWide,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecipeCardWide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { recipe: MOCK_RECIPE, onPress: () => undefined },
};

export const PendingNutrition: Story = {
  args: {
    recipe: { ...MOCK_RECIPE, calories: 0, protein: 0 },
    onPress: () => undefined,
  },
};
