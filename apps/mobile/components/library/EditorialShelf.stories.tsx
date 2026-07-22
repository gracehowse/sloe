import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_RECIPE } from "../_mobileStoryDecorators";
import { EditorialShelf } from "./EditorialShelf";

const recipes = [
  MOCK_RECIPE,
  { ...MOCK_RECIPE, id: "r2", title: "Sesame tofu crunch bowl" },
  { ...MOCK_RECIPE, id: "r3", title: "Lemon herb cod" },
];

const meta = {
  title: "Mobile/Library/EditorialShelf",
  component: EditorialShelf,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EditorialShelf>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Fits your day",
    subtitle: "Balanced picks from your cookbook",
    recipes,
    onPressRecipe: () => undefined,
  },
};

export const SingleRecipe: Story = {
  args: {
    title: "Quick",
    subtitle: "Under 30 minutes",
    recipes: [MOCK_RECIPE],
    onPressRecipe: () => undefined,
  },
};
