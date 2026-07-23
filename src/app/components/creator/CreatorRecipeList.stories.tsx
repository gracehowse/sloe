import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreatorRecipeList } from "./CreatorRecipeList";

const sampleRecipes = [
  {
    id: "r1",
    title: "Miso salmon bowl",
    image_url: null,
    calories: 520,
    protein: 42,
    carbs: 38,
    cook_time_min: 18,
    prep_time_min: 10,
  },
  {
    id: "r2",
    title: "Charred broccoli with tahini",
    image_url: null,
    calories: 210,
    protein: 8,
    carbs: 16,
    cook_time_min: 12,
    prep_time_min: 5,
  },
  {
    id: "r3",
    title: "Chickpea shakshuka",
    image_url: null,
    calories: 340,
    protein: 18,
    carbs: 42,
    cook_time_min: 22,
    prep_time_min: 8,
  },
];

const meta = {
  title: "Suppr/Creator/CreatorRecipeList",
  component: CreatorRecipeList,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    creatorId: "creator-1",
    initialRecipes: sampleRecipes,
    initialHasMore: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreatorRecipeList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLoadMore: Story = {};

export const CompleteCatalog: Story = {
  args: {
    initialHasMore: false,
  },
};

export const V3Grid: Story = {
  name: "V3 two-column grid",
  args: {
    initialHasMore: false,
  },
};
