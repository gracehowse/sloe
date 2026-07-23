import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_RECIPE } from "../_mobileStoryDecorators";
import { FeaturedHero } from "./FeaturedHero";

const meta = {
  title: "Mobile/Library/FeaturedHero",
  component: FeaturedHero,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FeaturedHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { recipe: MOCK_RECIPE, onPress: () => undefined },
};

export const NoNutrition: Story = {
  args: {
    recipe: { ...MOCK_RECIPE, calories: 0, protein: 0, prepTimeMin: null, cookTimeMin: null },
    onPress: () => undefined,
  },
};
