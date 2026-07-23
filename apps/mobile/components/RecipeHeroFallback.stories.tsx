import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { RecipeHeroFallback } from "./RecipeHeroFallback";

const meta = {
  title: "Mobile/Components/RecipeHeroFallback",
  component: RecipeHeroFallback,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecipeHeroFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SalmonBowl: Story = {
  args: {
    recipe: { id: "r1", title: "Miso ginger salmon bowl" },
    style: { width: 320, height: 180, borderRadius: 24 },
  },
};

export const PastaNight: Story = {
  args: {
    recipe: { id: "r2", title: "Creamy tomato pasta" },
    style: { width: 188, height: 128, borderRadius: 16 },
  },
};
