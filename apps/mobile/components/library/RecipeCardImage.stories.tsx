import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StyleSheet } from "react-native";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { RecipeCardImage } from "./RecipeCardImage";

const meta = {
  title: "Mobile/Library/RecipeCardImage",
  component: RecipeCardImage,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecipeCardImage>;

export default meta;
type Story = StoryObj<typeof meta>;

const cardStyle = { width: 160, height: 120, borderRadius: 16 } as const;

export const Fallback: Story = {
  args: {
    uri: null,
    cardImageStyle: cardStyle,
    recipeId: "story-1",
    recipeTitle: "Harissa roast chicken",
  },
};

export const WithUrl: Story = {
  args: {
    uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
    cardImageStyle: cardStyle,
    recipeId: "story-2",
    recipeTitle: "Green salad bowl",
  },
};
