import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreatorStatsCard } from "./CreatorStatsCard";

const meta = {
  title: "Suppr/Creator/CreatorStatsCard",
  component: CreatorStatsCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { recipeCount: 24, followerCount: 1200, followingCount: 0 },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof CreatorStatsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleRecipe: Story = {
  args: { recipeCount: 1, followerCount: 3, followingCount: 0 },
};
